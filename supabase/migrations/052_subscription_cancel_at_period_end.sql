-- TASK-126: the profile needs to show "Active · cancels <date>" after a user
-- cancels. Stripe keeps the subscription active until the period ends, so
-- `status` alone can't express it — mirror Stripe's flag into our table.
--
-- Written by: POST /api/subscription/cancel (immediately, so the UI updates
-- on the same request) and the customer.subscription.updated webhook (the
-- source of truth, including when the user un-cancels from Stripe's portal).

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;
