-- TASK-136: the admin dashboard could show how many subscriptions are active
-- but not a single figure about money. Nothing in this database has ever held
-- an amount: `subscriptions` carries status and dates only, and the Stripe
-- webhook handled four events, none of which records what was paid.
--
-- Two additions:
--   1. a `payments` table, written by the webhook and backfilled once from
--      Stripe (scripts/backfill-payments.mjs)
--   2. plan amount and interval on `subscriptions`, so MRR is a query here
--      rather than another round trip to Stripe on every dashboard load

-- ── payments ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payments (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The idempotency key for the webhook. Stripe retries deliveries, and
  -- invoice.payment_succeeded can arrive more than once for the same charge;
  -- the unique constraint turns a replay into a no-op upsert.
  stripe_charge_id   TEXT        UNIQUE NOT NULL,
  stripe_invoice_id  TEXT,
  stripe_customer_id TEXT,

  -- ON DELETE SET NULL, deliberately not CASCADE. profiles.id cascades from
  -- auth.users, so a hard delete of an auth user would otherwise erase that
  -- customer's payment history along with them. A financial record has to
  -- outlive the account it belonged to; an orphaned row still counts toward
  -- revenue, it just no longer names anyone.
  user_id            UUID        REFERENCES profiles(id) ON DELETE SET NULL,

  -- Minor units (cents), as Stripe reports them. Never floating point: a
  -- sum of thousands of rounded halves is not the number anyone expects.
  amount             BIGINT      NOT NULL CHECK (amount >= 0),
  amount_refunded    BIGINT      NOT NULL DEFAULT 0 CHECK (amount_refunded >= 0),

  -- Stripe's cut, taken from the charge's balance transaction. Kept per row
  -- rather than as a percentage because it varies by card and country.
  fee                BIGINT      NOT NULL DEFAULT 0 CHECK (fee >= 0),

  currency           TEXT        NOT NULL,
  paid_at            TIMESTAMPTZ NOT NULL,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_user    ON payments(user_id);

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- No policy for anon or authenticated: revenue is not a user-facing number,
-- and nobody but the service role reads this table. RLS with no SELECT policy
-- denies by default; the explicit GRANT is still required (see 051).
GRANT ALL ON public.payments TO service_role;

-- ── subscriptions: what the plan costs ──────────────────────────────────────
-- MRR needs the amount and the billing interval per subscription. Neither was
-- stored, so there was no way to tell a monthly subscriber from a yearly one,
-- let alone add them up. Written by the Stripe webhook on every upsert and
-- filled in for existing rows by the backfill script.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS plan_amount   BIGINT,
  ADD COLUMN IF NOT EXISTS plan_interval TEXT
    CHECK (plan_interval IN ('day', 'week', 'month', 'year')),
  ADD COLUMN IF NOT EXISTS plan_currency TEXT;

-- ── Aggregates ──────────────────────────────────────────────────────────────
-- Summed here rather than in the endpoint: PostgREST caps a response at 1000
-- rows, so "fetch every payment and add them up in JS" quietly starts
-- reporting a number that is too low once the table outgrows that cap. The
-- failure would look like revenue going down.
--
-- Grouped by currency rather than assuming one. Adding two currencies into a
-- single figure produces a number that is not money in any currency, and the
-- prices live in Stripe where this code cannot see how many there are.

CREATE OR REPLACE FUNCTION admin_revenue_summary()
RETURNS TABLE (
  currency       TEXT,
  payments_count BIGINT,
  gross          BIGINT,
  refunded       BIGINT,
  fees           BIGINT,
  gross_30d      BIGINT,
  refunded_30d   BIGINT,
  fees_30d       BIGINT,
  gross_month    BIGINT,
  refunded_month BIGINT,
  fees_month     BIGINT
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    p.currency,
    COUNT(*)::BIGINT,
    COALESCE(SUM(p.amount), 0)::BIGINT,
    COALESCE(SUM(p.amount_refunded), 0)::BIGINT,
    COALESCE(SUM(p.fee), 0)::BIGINT,
    COALESCE(SUM(p.amount)          FILTER (WHERE p.paid_at >= NOW() - INTERVAL '30 days'), 0)::BIGINT,
    COALESCE(SUM(p.amount_refunded) FILTER (WHERE p.paid_at >= NOW() - INTERVAL '30 days'), 0)::BIGINT,
    COALESCE(SUM(p.fee)             FILTER (WHERE p.paid_at >= NOW() - INTERVAL '30 days'), 0)::BIGINT,
    COALESCE(SUM(p.amount)          FILTER (WHERE p.paid_at >= date_trunc('month', NOW())), 0)::BIGINT,
    COALESCE(SUM(p.amount_refunded) FILTER (WHERE p.paid_at >= date_trunc('month', NOW())), 0)::BIGINT,
    COALESCE(SUM(p.fee)             FILTER (WHERE p.paid_at >= date_trunc('month', NOW())), 0)::BIGINT
  FROM payments p
  GROUP BY p.currency
  ORDER BY SUM(p.amount) DESC;
$$;

-- MRR from what each active subscription actually costs. Yearly plans are
-- divided by 12 — that is the standard normalisation, and it means MRR is an
-- estimate of recurring revenue, not cash collected this month.
--
-- Subscriptions set to cancel at period end are still counted: they are
-- active and still paying until the period runs out. The Subscription column
-- on /admin/users is where the ones on their way out are visible.
CREATE OR REPLACE FUNCTION admin_mrr()
RETURNS TABLE (currency TEXT, mrr BIGINT, subscriptions BIGINT)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    s.plan_currency,
    COALESCE(SUM(
      CASE s.plan_interval
        WHEN 'month' THEN s.plan_amount
        WHEN 'year'  THEN s.plan_amount / 12
        WHEN 'week'  THEN s.plan_amount * 52 / 12
        WHEN 'day'   THEN s.plan_amount * 365 / 12
      END
    ), 0)::BIGINT,
    COUNT(*)::BIGINT
  FROM subscriptions s
  WHERE s.status = 'active'
    AND s.plan_amount IS NOT NULL
    AND s.plan_interval IS NOT NULL
  GROUP BY s.plan_currency;
$$;

-- SECURITY DEFINER means these run as the owner and see past RLS, so the
-- default EXECUTE grant to anon/authenticated would publish revenue through
-- PostgREST to anyone holding the anon key.
REVOKE ALL ON FUNCTION admin_revenue_summary() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION admin_mrr()             FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_revenue_summary() TO service_role;
GRANT EXECUTE ON FUNCTION admin_mrr()             TO service_role;
