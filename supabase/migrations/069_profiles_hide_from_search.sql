-- TASK-161: let a user opt out of Messages → People search.
--
-- TASK-159 made subscribers able to find people by display name, which for
-- the first time reaches accounts that never set a username. Anyone who does
-- not want to be found that way can switch this on in Profile → Privacy.
--
-- It only hides the account from /api/profiles/search. The profile page,
-- favorites, existing conversations and the admin user search are untouched.
-- Default false keeps today's behaviour for everyone who does nothing.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hide_from_search BOOLEAN NOT NULL DEFAULT FALSE;
