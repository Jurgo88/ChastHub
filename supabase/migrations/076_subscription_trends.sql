-- TASK-187: subscriptions over time, and who is behind on payment.
--
-- subscriptions kept only the current state: the webhook overwrote status and
-- nothing remembered when someone cancelled or when a subscription ended.
-- These two columns copy Stripe's own timestamps (Subscription.canceled_at and
-- .ended_at) on customer.subscription.updated / .deleted, and a new checkout
-- clears them. Copying Stripe's values rather than stamping now() keeps them
-- right on webhook retries, and follows a customer who un-cancels (Stripe
-- nulls canceled_at again).
--
-- Cancellations before this deploy are not recorded; the section says so.
-- New paying customers come from payments and go back further.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at    TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.admin_subscription_trends()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
WITH
weeks AS (
  SELECT (date_trunc('week', now() AT TIME ZONE 'Europe/Bratislava') - (g * interval '1 week'))::date AS wk
    FROM generate_series(0, 11) g
),
paid AS (
  SELECT pm.user_id, pm.currency, pm.amount - coalesce(pm.amount_refunded, 0) AS net,
         (date_trunc('week', coalesce(pm.paid_at, pm.created_at) AT TIME ZONE 'Europe/Bratislava'))::date AS wk
    FROM public.payments pm
   WHERE pm.amount > 0
),
first_paid AS (
  SELECT pm.user_id,
         (date_trunc('week', min(coalesce(pm.paid_at, pm.created_at)) AT TIME ZONE 'Europe/Bratislava'))::date AS wk
    FROM public.payments pm
   WHERE pm.amount > 0 AND pm.user_id IS NOT NULL
   GROUP BY pm.user_id
)
SELECT jsonb_build_object(
  'paying_now',     (SELECT count(*) FROM public.subscriptions s WHERE s.status IN ('active', 'past_due')),
  'cancelling_now', (SELECT count(*) FROM public.subscriptions s WHERE s.status = 'active' AND s.cancel_at_period_end),
  'weekly', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'week',            w.wk,
             'new_paying',      (SELECT count(*) FROM first_paid f WHERE f.wk = w.wk),
             'payments',        (SELECT count(*) FROM paid p WHERE p.wk = w.wk),
             'collected',       (SELECT coalesce(jsonb_object_agg(x.currency, x.net), '{}'::jsonb)
                                   FROM (SELECT p.currency, sum(p.net) AS net FROM paid p WHERE p.wk = w.wk GROUP BY p.currency) x),
             'cancel_requests', (SELECT count(*) FROM public.subscriptions s
                                  WHERE (date_trunc('week', s.canceled_at AT TIME ZONE 'Europe/Bratislava'))::date = w.wk),
             'ended',           (SELECT count(*) FROM public.subscriptions s
                                  WHERE (date_trunc('week', s.ended_at AT TIME ZONE 'Europe/Bratislava'))::date = w.wk)
           ) ORDER BY w.wk), '[]'::jsonb)
      FROM weeks w
  ),
  -- Named on purpose: these are the people to contact before access lapses.
  'past_due', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'user_id',            p.id,
             'display_name',       p.display_name,
             'email',              p.email,
             'access_until',       s.current_period_end,
             'plan_amount',        s.plan_amount,
             'plan_currency',      s.plan_currency,
             'plan_interval',      s.plan_interval
           ) ORDER BY s.current_period_end NULLS LAST), '[]'::jsonb)
      FROM public.subscriptions s
      JOIN public.profiles p ON p.id = s.user_id
     WHERE s.status = 'past_due'
  )
);
$$;

REVOKE EXECUTE ON FUNCTION public.admin_subscription_trends() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_subscription_trends() TO service_role;
