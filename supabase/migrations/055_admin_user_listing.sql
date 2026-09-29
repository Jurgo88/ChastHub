-- TASK-131: the admin user listing read `profiles.subscription_status`, which
-- only knows 'active' / 'inactive'. Two states an admin needs are invisible
-- there:
--
--   * past_due — src/server/api/webhooks/stripe.post.ts deliberately keeps
--     the profile flag on 'active' for a 3-day grace period after a failed
--     payment, so a user whose card is bouncing reads as a paying customer.
--   * cancel_at_period_end — someone who cancelled but still has access until
--     the period ends (TASK-126, migration 052) is indistinguishable from
--     someone who is staying.
--
-- Both live on `subscriptions`. This view flattens profile + subscription into
-- one row so the admin endpoint can filter, sort and paginate over the real
-- billing state in a single query — `.in()` over a joined column would
-- otherwise have to choose between an inner join (which drops users who never
-- subscribed) and filtering in the app (which breaks the exact count).
--
-- The profile flag is left exactly as it is: it gates loq acceptance
-- (auth.ts, accept.post.ts) and the grace period is intentional there.

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
  -- 'canceled' is in the subscriptions CHECK constraint but the webhook never
  -- writes it — customer.subscription.deleted writes 'inactive'. It falls into
  -- 'lapsed' with the rest either way.
  CASE
    WHEN s.user_id IS NULL                              THEN 'none'
    WHEN s.status = 'past_due'                          THEN 'past_due'
    WHEN s.status = 'active' AND s.cancel_at_period_end THEN 'cancelling'
    WHEN s.status = 'active'                            THEN 'active'
    ELSE 'lapsed'
  END                                                    AS billing_status,
  s.cancel_at_period_end,
  s.current_period_end
FROM profiles p
LEFT JOIN subscriptions s ON s.user_id = p.id;

-- This view carries every user's email address. Supabase grants SELECT on new
-- objects in `public` to anon/authenticated by default, which would publish it
-- through PostgREST — revoke that explicitly. Only the service role, which the
-- admin endpoints use, may read it.
ALTER VIEW admin_user_listing SET (security_invoker = on);

REVOKE ALL ON admin_user_listing FROM anon, authenticated;
GRANT SELECT ON admin_user_listing TO service_role;
