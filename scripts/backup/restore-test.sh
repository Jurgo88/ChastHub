#!/usr/bin/env bash
# Weekly restore test (TASK-157). Run by
# .github/workflows/backup-restore-test.yml. Proves the newest backup can
# actually be restored, instead of assuming it:
#
#   1. Fails if the newest db/daily/ backup is older than 36 hours, which
#      catches a nightly job that silently stopped running.
#   2. Downloads and decrypts it, then verifies the checksums.
#   3. Starts a throwaway local Supabase database (same auth/storage schemas
#      as a real project) and restores into it exactly the way
#      docs/BACKUPS.md restores into a new project.
#   4. Row count of every table must equal the count recorded in the dump.
#   5. Every Storage bucket mirror must hold its files and decrypt.
#
# Requires: supabase CLI, Docker, rclone.

set -euo pipefail

source "$(dirname "$0")/rclone-env.sh"

MAX_AGE_HOURS=36
WORK="$(mktemp -d)"
PROJECT="$WORK/chasthub-restore-test"
cleanup() {
  supabase stop --no-backup --workdir "$PROJECT" > /dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

latest="$(rclone lsf vault:db/daily/ --dirs-only | sort | tail -1 | tr -d '/')"
if [ -z "$latest" ]; then
  echo "::error::No backups found under db/daily/"
  exit 1
fi
# Stamps look like 2026-09-25T0800Z.
taken_at="$(date -u -d "${latest:0:10} ${latest:11:2}:${latest:13:2}" +%s)"
age_hours=$(( ($(date -u +%s) - taken_at) / 3600 ))
echo "Newest backup: $latest (${age_hours}h old)"
if [ "$age_hours" -gt "$MAX_AGE_HOURS" ]; then
  echo "::error::Newest backup is ${age_hours}h old, the nightly backup job has stopped running"
  exit 1
fi

echo "::group::Download and verify"
BACKUP="$WORK/backup"
rclone copy "vault:db/daily/$latest" "$BACKUP"
(cd "$BACKUP" && sha256sum -c SHA256SUMS && gunzip ./*.sql.gz)
echo "::endgroup::"

meta() { sed -n "s/^$1=//p" "$BACKUP/meta.env"; }

echo "::group::Start a throwaway Supabase database"
mkdir -p "$PROJECT"
supabase init --workdir "$PROJECT" > /dev/null
pg_major="$(meta PG_MAJOR)"
if [ -n "$pg_major" ]; then
  sed -i -E "s/^major_version = .*/major_version = $pg_major/" "$PROJECT/supabase/config.toml"
fi
# The CLI reads these to run the same service versions as a linked project,
# so auth/storage tables have the columns the dumped rows expect.
mkdir -p "$PROJECT/supabase/.temp"
for pair in GOTRUE_VERSION:gotrue-version STORAGE_VERSION:storage-version; do
  value="$(meta "${pair%%:*}")"
  if [ -n "$value" ]; then echo "$value" > "$PROJECT/supabase/.temp/${pair#*:}"; fi
done
supabase db start --workdir "$PROJECT"
DB_CONTAINER="$(docker ps --filter 'name=^supabase_db_' --format '{{.Names}}' | sed -n 1p)"
echo "::endgroup::"

# psql inside the database container, so the client matches the server.
in_db() { docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" psql -h 127.0.0.1 -U postgres -d postgres "$@"; }

echo "::group::Restore"
docker cp "$BACKUP/." "$DB_CONTAINER:/tmp/restore"
in_db --single-transaction -v ON_ERROR_STOP=1 -q \
  -f /tmp/restore/roles.sql \
  -f /tmp/restore/schema.sql \
  -c 'SET session_replication_role = replica' \
  -f /tmp/restore/data.sql
echo "::endgroup::"

echo "::group::Compare row counts"
count_sql="$(awk -F'\t' '{
  split($1, p, ".")
  printf "%sSELECT %s, count(*) FROM \"%s\".\"%s\"\n", (NR > 1 ? "UNION ALL " : ""), "'\''" $1 "'\''", p[1], p[2]
}' "$BACKUP/counts.tsv")"
in_db -AtF $'\t' -c "$count_sql" | sort > "$WORK/restored.tsv"
if ! diff -u "$BACKUP/counts.tsv" "$WORK/restored.tsv"; then
  echo "::error::Restored row counts differ from the dump (- dump, + restored)"
  exit 1
fi
echo "All $(wc -l < "$BACKUP/counts.tsv") tables match."
echo "::endgroup::"

echo "::group::Check Storage mirror"
storage_failed=0
while IFS=$'\t' read -r bucket expected; do
  [ -n "$bucket" ] || continue
  mirrored="$(rclone lsf -R --files-only "vault:storage/$bucket" 2>/dev/null | wc -l)" || mirrored=0
  echo "$bucket: $mirrored files mirrored, $expected in storage.objects"
  # Uploads between the dump and the mirror step make small differences
  # normal; a large gap means the mirror is broken.
  if [ "$mirrored" -lt $(( expected * 9 / 10 )) ]; then
    echo "::error::Bucket $bucket mirror is missing files"
    storage_failed=1
    continue
  fi
  # Decrypting a real file proves the key and the crypt layer work end to end.
  # sed rather than head: head exits early and rclone's SIGPIPE would trip pipefail.
  sample="$(rclone lsf -R --files-only "vault:storage/$bucket" | sed -n 1p)"
  if [ -n "$sample" ] && [ "$(rclone cat "vault:storage/$bucket/$sample" | wc -c)" -eq 0 ]; then
    echo "::error::Could not decrypt vault:storage/$bucket/$sample"
    storage_failed=1
  fi
done < <(in_db -AtF $'\t' -c 'SELECT bucket_id, count(*) FROM storage.objects GROUP BY 1 ORDER BY 1')
echo "::endgroup::"
[ "$storage_failed" -eq 0 ] || exit 1

{
  echo "### Restore test passed"
  echo
  echo "Backup \`$latest\` (${age_hours}h old) restored into a fresh database;"
  echo "all $(wc -l < "$BACKUP/counts.tsv") tables match the dump row for row."
} >> "${GITHUB_STEP_SUMMARY:-/dev/stdout}"
