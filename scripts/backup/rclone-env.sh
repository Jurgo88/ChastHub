# Sourced by backup.sh and restore-test.sh (TASK-157). Defines three rclone
# remotes purely through environment variables, so no rclone.conf with
# credentials is ever written to disk:
#
#   r2:     the Cloudflare R2 account (raw, sees only ciphertext)
#   vault:  crypt layer over r2:$BACKUP_R2_BUCKET — everything we write or
#           read goes through this, so R2 only ever stores encrypted bytes
#   supa:   Supabase Storage via its S3-compatible endpoint (backup.sh and
#           the storage check in restore-test.sh only)
#
# File contents are encrypted; file and directory NAMES are left readable on
# purpose. The R2 lifecycle and bucket-lock rules match on prefixes
# (db/daily/, db/weekly/, ...), which would stop working if names were
# encrypted. Names are timestamps and the UUID paths Storage already uses.

: "${BACKUP_R2_ACCOUNT_ID:?}" "${BACKUP_R2_ACCESS_KEY_ID:?}" "${BACKUP_R2_SECRET_ACCESS_KEY:?}"
: "${BACKUP_R2_BUCKET:?}" "${BACKUP_ENCRYPTION_KEY:?}"

export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ENDPOINT="https://${BACKUP_R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$BACKUP_R2_ACCESS_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$BACKUP_R2_SECRET_ACCESS_KEY"
# The token is scoped to one bucket and cannot create/list buckets.
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true

export RCLONE_CONFIG_VAULT_TYPE=crypt
export RCLONE_CONFIG_VAULT_REMOTE="r2:${BACKUP_R2_BUCKET}"
export RCLONE_CONFIG_VAULT_FILENAME_ENCRYPTION=off
export RCLONE_CONFIG_VAULT_DIRECTORY_NAME_ENCRYPTION=false
# rclone wants the key "obscured" (reversible encoding, not security); the
# secret itself stays a plain random string that is easy to keep offline.
RCLONE_CONFIG_VAULT_PASSWORD="$(rclone obscure "$BACKUP_ENCRYPTION_KEY")"
export RCLONE_CONFIG_VAULT_PASSWORD

if [ -n "${BACKUP_STORAGE_ACCESS_KEY_ID:-}" ]; then
  # Endpoint as shown on the dashboard's Storage → S3 page
  # (https://<ref>.storage.supabase.co/storage/v1/s3).
  : "${BACKUP_STORAGE_ENDPOINT:?}" "${BACKUP_STORAGE_SECRET_ACCESS_KEY:?}" "${BACKUP_STORAGE_REGION:?}"
  export RCLONE_CONFIG_SUPA_TYPE=s3
  export RCLONE_CONFIG_SUPA_PROVIDER=Other
  export RCLONE_CONFIG_SUPA_ENDPOINT="$BACKUP_STORAGE_ENDPOINT"
  export RCLONE_CONFIG_SUPA_REGION="$BACKUP_STORAGE_REGION"
  export RCLONE_CONFIG_SUPA_FORCE_PATH_STYLE=true
  export RCLONE_CONFIG_SUPA_ACCESS_KEY_ID="$BACKUP_STORAGE_ACCESS_KEY_ID"
  export RCLONE_CONFIG_SUPA_SECRET_ACCESS_KEY="$BACKUP_STORAGE_SECRET_ACCESS_KEY"
fi
