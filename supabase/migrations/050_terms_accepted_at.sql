-- TASK-101: track 18+/Terms & Privacy confirmation at signup.
-- Nullable — existing accounts predate this and are left unset.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
