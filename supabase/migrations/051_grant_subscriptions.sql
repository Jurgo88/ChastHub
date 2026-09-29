-- 006_create_subscriptions.sql fell in the 003-009 range that 013_grant_service_role.sql
-- was meant to fix, but subscriptions was missed. service_role bypasses RLS but still
-- needs an explicit GRANT, so writes from the Stripe webhook fail with
-- "permission denied for table subscriptions" without this.

GRANT ALL ON public.subscriptions TO service_role;
