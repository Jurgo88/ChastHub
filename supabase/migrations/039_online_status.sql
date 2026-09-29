-- TASK-068: online status / last seen.
-- "Online" itself is tracked client-side via Supabase Realtime Presence
-- (no DB column needed for that — presence lives in the socket connection,
-- not the database). last_seen_at is the durable fallback for "last seen
-- Xm ago" once a user disconnects.

ALTER TABLE profiles
  ADD COLUMN last_seen_at TIMESTAMPTZ,
  ADD COLUMN show_online_status BOOLEAN NOT NULL DEFAULT TRUE;
