-- TASK-166: KPIs count from the public launch (ChastHub: 1 October 2026).
--
-- admin_kpi() (065) took "launch" to be the first non-admin signup, which is
-- a test account from well before the app went public. The DAU axis started
-- there and those accounts sat in every total.
--
-- Now the launch date is fixed, and accounts created before it are left out
-- of everything: DAU (even when they are active after launch), retention, loq
-- usage, countries, app opens and subscribers. Every other CTE already reads
-- users only through the `users` CTE, so filtering that one CTE covers them all.
--
-- The rest of the function is unchanged from 065.

CREATE OR REPLACE FUNCTION public.admin_kpi()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
WITH
today AS (SELECT (now() AT TIME ZONE 'Europe/Bratislava')::date AS d),
-- Public launch. Accounts created before it are test / pre-launch accounts.
launch AS (SELECT DATE '2026-10-01' AS d),
users AS (
  SELECT p.id, (p.created_at AT TIME ZONE 'Europe/Bratislava')::date AS d0, p.signup_country
    FROM public.profiles p
   WHERE NOT p.is_admin
     AND (p.created_at AT TIME ZONE 'Europe/Bratislava')::date >= (SELECT d FROM launch)
),
tracked AS (
  SELECT a.user_id, a.day AS d, a.sessions
    FROM public.user_activity_days a
   WHERE a.user_id IN (SELECT id FROM users)
),
auth_activity AS (
  SELECT aa.user_id, aa.ts FROM public.admin_auth_activity() aa
),
signals AS (
  SELECT aa.user_id, aa.ts FROM auth_activity aa
  UNION ALL SELECT p.id, p.created_at FROM public.profiles p
  UNION ALL SELECT p.id, p.last_seen_at FROM public.profiles p WHERE p.last_seen_at IS NOT NULL
  UNION ALL SELECT l.loqee_id, l.created_at FROM public.loqs l
  UNION ALL SELECT l.loqholder_id, l.accepted_at FROM public.loqs l WHERE l.loqholder_id IS NOT NULL AND l.accepted_at IS NOT NULL
  UNION ALL SELECT r.loqholder_id, r.created_at FROM public.loq_requests r
  UNION ALL SELECT m.sender_id, m.created_at FROM public.messages m
  UNION ALL SELECT m.sender_id, m.created_at FROM public.dm_messages m
  UNION ALL SELECT v.user_id, v.created_at FROM public.loq_visitor_interactions v WHERE v.user_id IS NOT NULL
),
days AS (
  SELECT t.user_id, t.d FROM tracked t
  UNION
  SELECT s.user_id, (s.ts AT TIME ZONE 'Europe/Bratislava')::date
    FROM signals s
   WHERE s.user_id IN (SELECT id FROM users)
),
series AS (
  SELECT g::date AS d
    FROM generate_series((SELECT d FROM launch), (SELECT d FROM today), interval '1 day') AS g
),
daily AS (
  SELECT s.d,
         (SELECT count(*) FROM days x WHERE x.d = s.d)                                             AS dau,
         (SELECT count(*) FROM days x JOIN users u ON u.id = x.user_id WHERE x.d = s.d AND u.d0 < s.d) AS returning_users,
         (SELECT count(*) FROM users u WHERE u.d0 = s.d)                                           AS signups,
         (SELECT count(*) FROM tracked t WHERE t.d = s.d)                                          AS tracked_users,
         (SELECT coalesce(sum(t.sessions), 0) FROM tracked t WHERE t.d = s.d)                      AS sessions
    FROM series s
),
ret AS (
  SELECT u.d0 + 1 < td.d  AS d1_done,
         u.d0 + 3 < td.d  AS d3_done,
         u.d0 >= td.d - 30 AS recent,
         EXISTS (SELECT 1 FROM days x WHERE x.user_id = u.id AND x.d = u.d0 + 1)                   AS d1,
         EXISTS (SELECT 1 FROM days x WHERE x.user_id = u.id AND x.d = u.d0 + 3)                   AS d3,
         EXISTS (SELECT 1 FROM days x WHERE x.user_id = u.id AND x.d BETWEEN u.d0 + 1 AND u.d0 + 3) AS d1_3
    FROM users u CROSS JOIN today td
),
eng AS (
  SELECT count(DISTINCT t.user_id)    AS active_users,
         count(*)                     AS active_user_days,
         coalesce(sum(t.sessions), 0) AS sessions
    FROM tracked t, today td
   WHERE t.d > td.d - 30
),
countries AS (
  SELECT coalesce(u.signup_country, '') AS country, count(*) AS users
    FROM users u
   GROUP BY 1
)
SELECT jsonb_build_object(
  'generated_at',     now(),
  'launch',           (SELECT d FROM launch),
  'tracking_since',   (SELECT min(a.day) FROM public.user_activity_days a),
  'audit_log_active', EXISTS (SELECT 1 FROM auth_activity aa WHERE aa.ts > now() - interval '2 days'),
  'users',            (SELECT count(*) FROM users),

  'daily', (SELECT coalesce(jsonb_agg(to_jsonb(dl) ORDER BY dl.d), '[]'::jsonb) FROM daily dl),

  'retention', (
    SELECT jsonb_build_object(
      'd1_base',            count(*) FILTER (WHERE d1_done),
      'd1_returned',        count(*) FILTER (WHERE d1_done AND d1),
      'd3_base',            count(*) FILTER (WHERE d3_done),
      'd3_returned',        count(*) FILTER (WHERE d3_done AND d3),
      'd1_3_returned',      count(*) FILTER (WHERE d3_done AND d1_3),
      'recent_d1_base',     count(*) FILTER (WHERE recent AND d1_done),
      'recent_d1_returned', count(*) FILTER (WHERE recent AND d1_done AND d1),
      'recent_d3_base',     count(*) FILTER (WHERE recent AND d3_done),
      'recent_d3_returned', count(*) FILTER (WHERE recent AND d3_done AND d3)
    )
    FROM ret
  ),

  'funnel', jsonb_build_object(
    'registered',        (SELECT count(*) FROM users),
    'created_loq',       (SELECT count(DISTINCT l.loqee_id) FROM public.loqs l WHERE l.loqee_id IN (SELECT id FROM users)),
    'published_loq',     (SELECT count(DISTINCT l.loqee_id) FROM public.loqs l
                           WHERE l.status <> 'draft' AND l.loqee_id IN (SELECT id FROM users)),
    'loqholder_requested', (SELECT count(DISTINCT r.loqholder_id) FROM public.loq_requests r
                           WHERE r.loqholder_id IN (SELECT id FROM users)),
    'in_accepted_loq',   (SELECT count(*) FROM (
                            SELECT l.loqee_id AS u FROM public.loqs l WHERE l.accepted_at IS NOT NULL
                            UNION
                            SELECT l.loqholder_id FROM public.loqs l WHERE l.accepted_at IS NOT NULL AND l.loqholder_id IS NOT NULL
                          ) x WHERE x.u IN (SELECT id FROM users)),
    'voted',             (SELECT count(DISTINCT v.user_id) FROM public.loq_visitor_interactions v
                           WHERE v.user_id IN (SELECT id FROM users))
  ),

  'subscribers', jsonb_build_object(
    'new_24h',           (SELECT count(*) FROM public.subscriptions s
                           WHERE s.created_at >= now() - interval '24 hours' AND s.user_id IN (SELECT id FROM users)),
    'new_24h_active',    (SELECT count(*) FROM public.subscriptions s
                           WHERE s.created_at >= now() - interval '24 hours' AND s.status IN ('active', 'past_due')
                             AND s.user_id IN (SELECT id FROM users)),
    'first_payment_24h', (SELECT count(*) FROM (
                            SELECT pm.user_id, min(coalesce(pm.paid_at, pm.created_at)) AS first_paid
                              FROM public.payments pm
                             WHERE pm.amount > 0 AND pm.user_id IS NOT NULL
                             GROUP BY pm.user_id
                          ) f WHERE f.first_paid >= now() - interval '24 hours' AND f.user_id IN (SELECT id FROM users)),
    'active_total',      (SELECT count(*) FROM public.subscriptions s
                           WHERE s.status IN ('active', 'past_due') AND s.user_id IN (SELECT id FROM users))
  ),

  'engagement_30d', (SELECT to_jsonb(eng) FROM eng),

  'countries', (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.users DESC, c.country), '[]'::jsonb) FROM countries c)
);
$$;

REVOKE EXECUTE ON FUNCTION public.admin_kpi() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_kpi() TO service_role;
