-- TASK-189: why people leave, week by week.
--
-- Admin → Deletions (super_admin) lists each deletion with its reason; this
-- is the trend across them. It reads the account_deleted audit entries
-- (TASK-138) and returns reason codes and counts only: never the email or the
-- note, so every admin level may see it.
--
-- Weeks run Monday to Sunday in Bratislava time, from the launch week (22 Sept
-- 2026, as in 070) to now. A deletion without a recorded reason (from before
-- TASK-138 asked) counts as 'unknown'.

CREATE OR REPLACE FUNCTION public.admin_churn_reasons()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
WITH
deletions AS (
  SELECT coalesce(nullif(a.details->>'reason', ''), 'unknown') AS reason,
         (date_trunc('week', a.created_at AT TIME ZONE 'Europe/Bratislava'))::date AS wk
    FROM public.audit_log a
   WHERE a.action = 'account_deleted'
     AND (a.created_at AT TIME ZONE 'Europe/Bratislava')::date >= DATE '2026-10-01'
),
weeks AS (
  SELECT g::date AS wk
    FROM generate_series(
           date_trunc('week', DATE '2026-10-01'),
           date_trunc('week', now() AT TIME ZONE 'Europe/Bratislava'),
           interval '1 week') g
)
SELECT jsonb_build_object(
  'weeks', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'week',      w.wk,
             'total',     (SELECT count(*) FROM deletions d WHERE d.wk = w.wk),
             'by_reason', (SELECT coalesce(jsonb_object_agg(x.reason, x.n), '{}'::jsonb)
                             FROM (SELECT d.reason, count(*) AS n FROM deletions d WHERE d.wk = w.wk GROUP BY d.reason) x)
           ) ORDER BY w.wk DESC), '[]'::jsonb)
      FROM weeks w
  ),
  'totals', (
    SELECT coalesce(jsonb_object_agg(x.reason, x.n), '{}'::jsonb)
      FROM (SELECT d.reason, count(*) AS n FROM deletions d GROUP BY d.reason) x
  )
);
$$;

REVOKE EXECUTE ON FUNCTION public.admin_churn_reasons() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_churn_reasons() TO service_role;
