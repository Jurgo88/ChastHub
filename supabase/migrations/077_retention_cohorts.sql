-- TASK-188: retention by signup week.
--
-- One D1 / D3 number (the KPI panel) swings with few users and does not show
-- a trend. This groups signups by week and follows each week: back the next
-- day, back in the first week, back in the first month, ever paid.
--
-- admin_activity_days() is the KPI panel's definition of "active on day D"
-- (065/070) as a reusable function: app opens (user_activity_days), the auth
-- log when present, and in-app actions. Same launch cut-off (22 Sept 2026) and
-- admins excluded. admin_kpi() still carries its own copy; folding it onto
-- this is a refactor for another day.

CREATE OR REPLACE FUNCTION public.admin_activity_days()
RETURNS TABLE (user_id UUID, d DATE)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
WITH
users AS (
  SELECT p.id FROM public.profiles p
   WHERE NOT p.is_admin
     AND (p.created_at AT TIME ZONE 'Europe/Bratislava')::date >= DATE '2026-10-01'
),
signals AS (
  SELECT aa.user_id, aa.ts FROM public.admin_auth_activity() aa
  UNION ALL SELECT p.id, p.created_at FROM public.profiles p
  UNION ALL SELECT p.id, p.last_seen_at FROM public.profiles p WHERE p.last_seen_at IS NOT NULL
  UNION ALL SELECT l.loqee_id, l.created_at FROM public.loqs l
  UNION ALL SELECT l.loqholder_id, l.accepted_at FROM public.loqs l WHERE l.loqholder_id IS NOT NULL AND l.accepted_at IS NOT NULL
  UNION ALL SELECT r.loqholder_id, r.created_at FROM public.loq_requests r
  UNION ALL SELECT m.sender_id, m.created_at FROM public.messages m
  UNION ALL SELECT m.sender_id, m.created_at FROM public.dm_messages m
  UNION ALL SELECT v.user_id, v.created_at FROM public.loq_visitor_interactions v WHERE v.user_id IS NOT NULL
)
SELECT a.user_id, a.day FROM public.user_activity_days a WHERE a.user_id IN (SELECT id FROM users)
UNION
SELECT s.user_id, (s.ts AT TIME ZONE 'Europe/Bratislava')::date FROM signals s WHERE s.user_id IN (SELECT id FROM users)
$$;

REVOKE EXECUTE ON FUNCTION public.admin_activity_days() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_activity_days() TO service_role;


CREATE OR REPLACE FUNCTION public.admin_retention_cohorts()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
WITH
today AS (SELECT (now() AT TIME ZONE 'Europe/Bratislava')::date AS d),
days AS (SELECT ad.user_id, ad.d FROM public.admin_activity_days() ad),
paid AS (SELECT DISTINCT pm.user_id FROM public.payments pm WHERE pm.amount > 0 AND pm.user_id IS NOT NULL),
people AS (
  SELECT p.id,
         (p.created_at AT TIME ZONE 'Europe/Bratislava')::date AS d0,
         (date_trunc('week', p.created_at AT TIME ZONE 'Europe/Bratislava'))::date AS wk
    FROM public.profiles p
   WHERE NOT p.is_admin
     AND (p.created_at AT TIME ZONE 'Europe/Bratislava')::date >= DATE '2026-10-01'
),
flags AS (
  SELECT x.wk,
         x.d0 + 1  < t.d AS d1_done,
         x.d0 + 7  < t.d AS w1_done,
         x.d0 + 30 < t.d AS m1_done,
         EXISTS (SELECT 1 FROM days y WHERE y.user_id = x.id AND y.d = x.d0 + 1)                     AS d1,
         EXISTS (SELECT 1 FROM days y WHERE y.user_id = x.id AND y.d BETWEEN x.d0 + 1 AND x.d0 + 7)  AS w1,
         EXISTS (SELECT 1 FROM days y WHERE y.user_id = x.id AND y.d BETWEEN x.d0 + 8 AND x.d0 + 30) AS m1,
         x.id IN (SELECT user_id FROM paid)                                                        AS paid
    FROM people x, today t
)
SELECT jsonb_build_object(
  'cohorts', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'week',        c.wk,
             'size',        c.size,
             'd1_base',     c.d1_base,  'd1',   c.d1,
             'w1_base',     c.w1_base,  'w1',   c.w1,
             'm1_base',     c.m1_base,  'm1',   c.m1,
             'paid',        c.paid
           ) ORDER BY c.wk DESC), '[]'::jsonb)
      FROM (
        SELECT f.wk,
               count(*)                                   AS size,
               count(*) FILTER (WHERE f.d1_done)          AS d1_base,
               count(*) FILTER (WHERE f.d1_done AND f.d1) AS d1,
               count(*) FILTER (WHERE f.w1_done)          AS w1_base,
               count(*) FILTER (WHERE f.w1_done AND f.w1) AS w1,
               count(*) FILTER (WHERE f.m1_done)          AS m1_base,
               count(*) FILTER (WHERE f.m1_done AND f.m1) AS m1,
               count(*) FILTER (WHERE f.paid)             AS paid
          FROM flags f
         GROUP BY f.wk
      ) c
  )
);
$$;

REVOKE EXECUTE ON FUNCTION public.admin_retention_cohorts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_retention_cohorts() TO service_role;
