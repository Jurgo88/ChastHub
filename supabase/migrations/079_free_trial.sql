-- ChastHub launches without payments: every account gets a 30-day free trial
-- of the subscriber features. Access = paid subscription OR trial still running
-- (see src/utils/access.ts). When Stripe is added, the trial keeps working and
-- `subscription_status = 'active'` simply becomes a second way in.
--
-- The default is evaluated per row at insert time, so signup and the Google
-- OAuth path (both insert into profiles from server routes) get it without any
-- code change. Existing rows get a fresh 30 days from when this runs.
--
-- Clients never write to profiles (063), so a user cannot extend their own
-- trial through PostgREST; only the service role can change this column.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days');

COMMENT ON COLUMN public.profiles.trial_ends_at IS
  'End of the free trial. Premium access while now() < trial_ends_at, or while subscription_status = active.';
