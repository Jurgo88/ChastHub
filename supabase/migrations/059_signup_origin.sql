-- TASK-137: nothing recorded where a user came from. The question "which
-- countries are our users in" had no answer anywhere — not in profiles, not
-- in the subscription, not in Stripe for anyone who never paid.
--
-- Captured at signup from the edge headers the request already carries, so
-- nobody is asked to fill in a form. See src/server/utils/signupOrigin.ts.
--
-- Coarse on purpose. Netlify's geo payload also carries city, latitude and
-- longitude; none of it is stored. A row naming the city a named account on
-- an 18+ platform signed up from is a liability with no matching use. The IP
-- is not stored either — it already passes through `rate_limit_buckets`
-- briefly, and a permanent copy on the profile is a different proposition.
--
-- All four are nullable and stay that way: a signup from a host that sends no
-- geo headers records nothing, which is a normal outcome. Existing profiles
-- cannot be backfilled — the data was never collected, and inventing it would
-- be worse than leaving it empty.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS signup_country  TEXT CHECK (signup_country ~ '^[A-Z]{2}$'),
  ADD COLUMN IF NOT EXISTS signup_region   TEXT,
  ADD COLUMN IF NOT EXISTS signup_timezone TEXT,
  ADD COLUMN IF NOT EXISTS signup_locale   TEXT;

-- ── admin_user_listing ──────────────────────────────────────────────────────
-- Re-stated in full from 055 with the four columns appended. CREATE OR REPLACE
-- VIEW only allows adding columns at the end, so the existing ones keep their
-- order exactly.

CREATE OR REPLACE VIEW admin_user_listing AS
SELECT
  p.id,
  p.email,
  p.username,
  p.display_name,
  p.avatar_url,
  p.role,
  p.is_admin,
  p.status,
  p.deleted_at,
  p.created_at,
  CASE
    WHEN s.user_id IS NULL                              THEN 'none'
    WHEN s.status = 'past_due'                          THEN 'past_due'
    WHEN s.status = 'active' AND s.cancel_at_period_end THEN 'cancelling'
    WHEN s.status = 'active'                            THEN 'active'
    ELSE 'lapsed'
  END                                                    AS billing_status,
  s.cancel_at_period_end,
  s.current_period_end,
  p.signup_country,
  p.signup_region,
  p.signup_timezone,
  p.signup_locale
FROM profiles p
LEFT JOIN subscriptions s ON s.user_id = p.id;

-- CREATE OR REPLACE keeps existing grants, but re-stating them costs nothing
-- and means this file does not depend on 055 having been applied first to be
-- correct about who may read it.
ALTER VIEW admin_user_listing SET (security_invoker = on);

REVOKE ALL ON admin_user_listing FROM anon, authenticated;
GRANT SELECT ON admin_user_listing TO service_role;
