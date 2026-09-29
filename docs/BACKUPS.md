# Backups

ChastHub is on the Supabase Free plan, which keeps **no backups of its own**.
Everything below is the only copy of production data outside Supabase.

| What | How | When | Kept |
|---|---|---|---|
| Database (all schemas incl. `auth`, `storage`) | `supabase db dump` → roles / schema / data SQL | nightly 08:00 UTC | 14 daily, 8 weekly (Sun), 12 monthly (1st) |
| Storage files (every bucket) | incremental `rclone sync` via Supabase's S3 endpoint | nightly, same job | mirror; deleted/replaced files 90 days |
| Restore test | restore newest dump into a throwaway DB, compare row counts | Mondays 10:00 UTC | — |

- Workflows: [.github/workflows/backup.yml](../.github/workflows/backup.yml), [.github/workflows/backup-restore-test.yml](../.github/workflows/backup-restore-test.yml)
- Scripts: [scripts/backup/](../scripts/backup/)
- Destination: Cloudflare R2 bucket, everything encrypted client-side with rclone crypt
  (XSalsa20-Poly1305). R2 only ever sees ciphertext. File *names* stay readable so
  the lifecycle rules can match prefixes.
- A failed run emails whoever last edited the workflow's cron line.
- Stripe is not backed up here: Stripe is the source of truth for billing, `payments` is a copy.

Layout in the bucket:

```
db/daily/2026-09-25T0800Z/   roles.sql.gz schema.sql.gz data.sql.gz counts.tsv meta.env SHA256SUMS
db/weekly/…                  same, Sundays
db/monthly/…                 same, 1st of the month
storage/<bucket>/…           current mirror of each bucket
storage-deleted/<stamp>/…    files deleted or replaced in Supabase that night
```

> **The encryption key (`BACKUP_ENCRYPTION_KEY`) must also live outside GitHub**
> (password manager). Without it the backups are unreadable, by design. It is in
> GitHub secrets as well because the restore test must decrypt; anyone who can
> read those secrets can already read the live database via `BACKUP_DB_URL`, so
> this adds no new exposure. The encryption protects against the R2 side leaking.

---

## One-time setup

### 1. Cloudflare R2

1. Cloudflare dashboard → **R2 Object Storage** → enable (asks for a card even on the free tier).
2. **Create bucket** `chasthub-backups`, location Automatic. Leave public access **off**.
3. Bucket → **Settings → Object lifecycle rules**, add:

   | Rule name | Prefix | Action |
   |---|---|---|
   | daily | `db/daily/` | Delete objects after 14 days |
   | weekly | `db/weekly/` | Delete objects after 56 days |
   | monthly | `db/monthly/` | Delete objects after 365 days |
   | deleted-files | `storage-deleted/` | Delete objects after 90 days |
4. Bucket → **Settings → Bucket lock rules** → add rule, prefix `db/`, retain **14 days**.
   Nobody, including a leaked token, can delete or overwrite a database backup for
   its first 14 days. Do not lock `storage/`: the mirror must be able to change.
5. R2 overview → **Manage API tokens → Create API token**: permission
   **Object Read & Write**, *Apply to specific buckets only* → `chasthub-backups`, TTL forever.
   Note the **Access Key ID**, **Secret Access Key**, and the **Account ID** (R2 overview page).

### 2. Supabase

Direct links survive dashboard redesigns better than menu paths:

1. **Database URL**: `https://supabase.com/dashboard/project/<ref>?showConnect=true&method=session`
   → *Session pooler* (port 5432; GitHub runners are IPv4-only, the direct connection is
   IPv6). Put the database password in place of `[YOUR-PASSWORD]`; percent-encode special
   characters in it (`@` → `%40`, `#` → `%23`, …). Forgotten password: reset it at
   `…/project/<ref>/database/settings`; the app itself only uses API keys.
2. **Storage S3 keys**: `https://supabase.com/dashboard/project/<ref>/storage/s3` → *New access key*.
   Note the Access Key ID, Secret (shown once), and the **Endpoint** and **Region** on that page.

### 3. Encryption key

```bash
openssl rand -base64 32
```

Save the output in your password manager **first**, then use it for the secret below.

### 4. GitHub secrets

`gh secret set NAME` prompts for the value, so nothing lands in shell history:

```bash
gh secret set BACKUP_DB_URL                     # session pooler URI from 2.1
gh secret set BACKUP_STORAGE_ACCESS_KEY_ID      # from 2.2
gh secret set BACKUP_STORAGE_SECRET_ACCESS_KEY  # from 2.2
gh secret set BACKUP_STORAGE_REGION             # from 2.2, e.g. eu-west-1
gh secret set BACKUP_STORAGE_ENDPOINT           # from 2.2, https://<ref>.storage.supabase.co/storage/v1/s3
gh secret set BACKUP_R2_ACCOUNT_ID              # from 1.5
gh secret set BACKUP_R2_ACCESS_KEY_ID           # from 1.5
gh secret set BACKUP_R2_SECRET_ACCESS_KEY       # from 1.5
gh secret set BACKUP_R2_BUCKET                  # chasthub-backups
gh secret set BACKUP_ENCRYPTION_KEY             # from 3
gh secret set BACKUP_SUPABASE_URL               # https://<ref>.supabase.co
gh secret set BACKUP_SUPABASE_ANON_KEY          # public anon key, used only to read service versions
```

### 5. First run

Actions → **Backup** → *Run workflow*. When it is green, Actions → **Backup restore test**
→ *Run workflow*. Both jobs write a summary (row counts, sizes) on the run page.

---

## Restoring

Never restore a whole dump over the live database. Pick the scenario.

### Get the backup onto your machine

Needs `rclone`, the `supabase` CLI and Docker (Docker Desktop on Windows). In Git Bash,
export the same `BACKUP_R2_*` and `BACKUP_ENCRYPTION_KEY` values as the secrets, then:

```bash
source scripts/backup/rclone-env.sh
rclone lsf vault:db/daily/                        # also db/weekly/, db/monthly/
rclone copy vault:db/daily/<stamp> ./restore
cd restore && sha256sum -c SHA256SUMS && gunzip ./*.sql.gz
```

`counts.tsv` holds the row count of every table in that dump; `meta.env` the Postgres
major and auth/storage versions it came from.

### A. Rows or a table lost, project still alive

Restore into a local throwaway database, then copy back only what is missing:

```bash
supabase init --workdir ./restore-db
supabase db start --workdir ./restore-db          # local DB on port 54322, password postgres
docker cp ./restore/. supabase_db_restore-db:/tmp/restore
docker exec -e PGPASSWORD=postgres supabase_db_restore-db \
  psql -h 127.0.0.1 -U postgres -d postgres --single-transaction -v ON_ERROR_STOP=1 \
  -f /tmp/restore/roles.sql -f /tmp/restore/schema.sql \
  -c 'SET session_replication_role = replica' -f /tmp/restore/data.sql
```

Inspect it at `postgresql://postgres:postgres@127.0.0.1:54322/postgres` (or Studio via
`supabase start`), export the rows you need with `\copy … TO`, and load them into
production with the SQL Editor. `supabase stop --no-backup --workdir ./restore-db` when done.

### B. Whole project lost

1. Create a new Supabase project, same region.
2. Restore (psql 15+ from a PostgreSQL client install, or the container above):
   ```bash
   psql --single-transaction -v ON_ERROR_STOP=1 \
     -f roles.sql -f schema.sql -c 'SET session_replication_role = replica' -f data.sql \
     -d "<new project's session pooler URI>"
   ```
3. Storage: create S3 keys on the new project, point `supa:` at it
   (`BACKUP_STORAGE_*` incl. the new endpoint), and for each bucket: `rclone copy vault:storage/<bucket> supa:<bucket>`.
   The bucket rows and object metadata are already in `data.sql`.
4. Things that are **not** in the database, redo by hand: Auth URL configuration and
   redirect URLs, custom SMTP (TASK-156), email templates (`supabase/templates/`),
   S3 keys, the `NUXT_*` Supabase values in Netlify (then redeploy **with cache clear**:
   Nitro bakes runtime config into the build).
5. Users keep their passwords (hashes are in `auth.users`) but every session is invalid
   on the new project, so everyone signs in again.

### C. A single Storage file

```bash
rclone copy vault:storage/<bucket>/<path> .           # current mirror
rclone lsf -R vault:storage-deleted/                   # deleted/replaced in the last 90 days
```

---

## GDPR

A deleted account stays in backups until they expire (at most 12 months, the monthly
tier). The privacy policy should state this retention. If an old backup is ever
restored, re-apply every account deletion made since that backup was taken.
