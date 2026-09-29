-- TASK-127: users can delete their own account. `profiles.status` only knew
-- 'active' and 'banned', so there was no state to put a deleted account in.
--
-- Deletion is an anonymization, not a row delete: loqs, messages and
-- leaderboard history are shared with other users, and removing the row would
-- tear holes in *their* history (profiles.id is referenced with ON DELETE
-- CASCADE from auth.users, so a hard delete would take the loq and message
-- history with it). The row survives with every piece of personal data
-- scrubbed — see src/server/api/profile/delete.post.ts.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_status_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('active', 'banned', 'deleted'));

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Everything that already filters on status = 'active' (both leaderboard
-- views, /api/profiles/search) excludes 'deleted' for free. The lookups that
-- checked `status = 'banned'` explicitly were widened in the same change.
