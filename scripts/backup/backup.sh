#!/usr/bin/env bash
# Nightly off-site backup (TASK-157). Run by .github/workflows/backup.yml;
# setup and restore steps are in docs/BACKUPS.md.
#
#   1. Dumps the database with the Supabase CLI in the format Supabase's own
#      restore guide uses: roles.sql + schema.sql + data.sql. data.sql covers
#      every non-platform schema, so auth.users and storage.objects are in it.
#   2. Uploads the dump encrypted to R2 under db/daily/<stamp>/, and also to
#      db/weekly/ on Sundays and db/monthly/ on the 1st. R2 lifecycle rules
#      expire each prefix; this script never deletes anything.
#   3. Mirrors every Storage bucket into storage/<bucket>/. Files removed or
#      replaced in Supabase are moved to storage-deleted/<stamp>/ instead of
#      disappearing.
#
# Requires: supabase CLI (and Docker, which it runs pg_dump in), rclone, gzip.

set -euo pipefail

: "${BACKUP_DB_URL:?BACKUP_DB_URL must be the session pooler connection string}"
source "$(dirname "$0")/rclone-env.sh"

STAMP="$(date -u +%Y-%m-%dT%H%MZ)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
OUT="$WORK/out"
mkdir -p "$OUT"

echo "::group::Dump database"
supabase db dump --db-url "$BACKUP_DB_URL" -f "$WORK/roles.sql" --role-only
supabase db dump --db-url "$BACKUP_DB_URL" -f "$WORK/schema.sql"
# The vector-bucket tables are owned by supabase_storage_admin and not
# writable by postgres on any project, so their COPY aborts a restore
# ("permission denied for table buckets_vectors"). Supabase's restore guide
# excludes them too; ChastHub has no vector buckets (both tables are empty).
supabase db dump --db-url "$BACKUP_DB_URL" -f "$WORK/data.sql" --data-only --use-copy \
  -x storage.buckets_vectors -x storage.vector_indexes
echo "::endgroup::"

# Row count per table, read from the COPY blocks of the dump itself (COPY text
# format escapes newlines, so one line is one row). restore-test.sh compares
# the restored database against exactly these numbers.
awk '
  /^COPY "/ { t = $2; gsub(/"/, "", t); n = 0; inblock = 1; next }
  inblock && /^\\\.$/ { print t "\t" n; inblock = 0; next }
  inblock { n++ }
' "$WORK/data.sql" | sort > "$OUT/counts.tsv"

count_of() { awk -F'\t' -v t="$1" '$1 == t { print $2 }' "$OUT/counts.tsv"; }

# A dump that is missing users is not a backup; fail loudly instead of
# uploading it as if it were fine.
for table in public.profiles auth.users; do
  rows="$(count_of "$table")"
  if [ -z "$rows" ] || [ "$rows" -eq 0 ]; then
    echo "::error::$table is missing or empty in the dump, refusing to upload"
    exit 1
  fi
done

# Platform versions at dump time, so a restore (and restore-test.sh) can run
# the same Postgres major and auth/storage schema versions the data came
# from. Best effort: a missing value only means the restore uses defaults.
# Image tags are v-prefixed; storage's /version answers without the v.
version_like() { grep -xE 'v?[0-9]+(\.[0-9]+)+' | sed -E 's/^([0-9])/v\1/' || true; }
{
  if command -v psql > /dev/null; then
    echo "PG_MAJOR=$(psql "$BACKUP_DB_URL" -Atc 'show server_version_num' 2>/dev/null | awk '{ print int($1 / 10000) }')"
  fi
  if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_ANON_KEY:-}" ]; then
    echo "GOTRUE_VERSION=$(curl -fsS "${SUPABASE_URL%/}/auth/v1/health" -H "apikey: $SUPABASE_ANON_KEY" 2>/dev/null \
      | grep -oE '"version":"[^"]*"' | cut -d'"' -f4 | version_like)"
    echo "STORAGE_VERSION=$(curl -fsS "${SUPABASE_URL%/}/storage/v1/version" -H "apikey: $SUPABASE_ANON_KEY" 2>/dev/null \
      | tr -d '"[:space:]' | version_like)"
  fi
} > "$OUT/meta.env"

gzip -9 -c "$WORK/roles.sql"  > "$OUT/roles.sql.gz"
gzip -9 -c "$WORK/schema.sql" > "$OUT/schema.sql.gz"
gzip -9 -c "$WORK/data.sql"   > "$OUT/data.sql.gz"
(cd "$OUT" && sha256sum roles.sql.gz schema.sql.gz data.sql.gz counts.tsv meta.env > SHA256SUMS)

echo "::group::Upload database backup"
rclone copy "$OUT" "vault:db/daily/$STAMP"
if [ "$(date -u +%u)" = 7 ]; then rclone copy "$OUT" "vault:db/weekly/$STAMP"; fi
if [ "$(date -u +%d)" = 01 ]; then rclone copy "$OUT" "vault:db/monthly/$STAMP"; fi
echo "::endgroup::"

echo "::group::Mirror Storage buckets"
buckets="$(rclone lsf supa: --dirs-only | tr -d '/')"
if [ -z "$buckets" ]; then
  echo "::error::No Storage buckets listed, check the S3 access keys"
  exit 1
fi
for bucket in $buckets; do
  # Storage uploads use upsert:false, so a path never changes content and
  # comparing sizes is enough; it avoids a HEAD request per object.
  rclone sync "supa:$bucket" "vault:storage/$bucket" \
    --size-only --fast-list \
    --backup-dir "vault:storage-deleted/$STAMP/$bucket"
done
echo "::endgroup::"

{
  echo "### Backup $STAMP"
  echo
  echo "| Table | Rows |"
  echo "|---|---|"
  for table in auth.users public.profiles public.loqs public.dm_messages public.payments storage.objects; do
    echo "| \`$table\` | $(count_of "$table") |"
  done
  echo
  echo "Dump size (gzip): $(du -ch "$OUT"/*.gz | tail -1 | cut -f1). Buckets mirrored: $(echo $buckets)."
} >> "${GITHUB_STEP_SUMMARY:-/dev/stdout}"
