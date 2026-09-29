-- ChastHub: initial schema
--
-- One migration for the whole schema: tables, functions, row-level security,
-- privileges, storage buckets and realtime. It replaces the 78 incremental
-- migrations inherited from the earlier codebase and produces the same final
-- state, minus dead objects (the unused waitlist table and the superseded
-- add_visitor_time function), plus one security fix (see the end of the file).
--
-- Identifiers keep the inherited names (loqs, loqee, loqholder); the UI says
-- lock / wearer / keyholder.
--
-- Add schema changes as new files: 002_..., 003_...

-- Every name below is schema-qualified; function bodies are checked on first
-- use, so functions can be created before the tables they read.
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;

-- function: adjust_visitor_time(uuid, numeric, timestamp with time zone, timestamp with time zone)

CREATE FUNCTION public.adjust_visitor_time(p_loq_id uuid, p_delta_hours numeric, p_min_until timestamp with time zone, p_max_until timestamp with time zone) RETURNS timestamp with time zone
    LANGUAGE sql SECURITY DEFINER
    AS $$
  UPDATE loqs
  SET loqed_until = GREATEST(
    LEAST(loqed_until + (p_delta_hours || ' hours')::interval, p_max_until),
    p_min_until
  )
  WHERE id = p_loq_id
  RETURNING loqed_until;
$$;

-- function: admin_activity_days()

CREATE FUNCTION public.admin_activity_days() RETURNS TABLE(user_id uuid, d date)
    LANGUAGE sql STABLE
    SET search_path TO ''
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

-- function: admin_auth_activity()

CREATE FUNCTION public.admin_auth_activity() RETURNS TABLE(user_id uuid, ts timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $_$
BEGIN
  RETURN QUERY
    SELECT (e.payload->>'actor_id')::uuid, e.created_at
      FROM auth.audit_log_entries e
     WHERE e.payload->>'actor_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
EXCEPTION
  WHEN insufficient_privilege OR undefined_table THEN
    RETURN;
END;
$_$;

-- function: admin_churn_reasons()

CREATE FUNCTION public.admin_churn_reasons() RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO ''
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

-- function: admin_kpi()

CREATE FUNCTION public.admin_kpi() RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO ''
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

-- function: admin_marketplace()

CREATE FUNCTION public.admin_marketplace() RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
WITH
-- Loqs that went looking for a loqholder. Exact when published_at is set;
-- before it existed, the ones that got a loqholder or are waiting now.
sought AS (
  SELECT l.id, l.status, l.accepted_at,
         coalesce(l.published_at, l.created_at) AS pub,
         l.published_at IS NOT NULL             AS exact
    FROM public.loqs l
   WHERE l.published_at IS NOT NULL
      OR l.status = 'pending'
      OR (l.accepted_at IS NOT NULL AND l.loqholder_id IS NOT NULL)
),
recent AS (
  SELECT s.*, extract(epoch FROM (s.accepted_at - s.pub)) / 3600.0 AS hours
    FROM sought s
   WHERE s.pub >= now() - interval '30 days'
),
weeks AS (
  SELECT (date_trunc('week', now() AT TIME ZONE 'Europe/Bratislava') - (g * interval '1 week'))::date AS wk
    FROM generate_series(0, 7) g
),
active_30d AS (
  SELECT DISTINCT a.user_id FROM public.user_activity_days a WHERE a.day > (now() AT TIME ZONE 'Europe/Bratislava')::date - 30
)
SELECT jsonb_build_object(
  'exact_since',        (SELECT (min(l.published_at) AT TIME ZONE 'Europe/Bratislava')::date FROM public.loqs l),
  'waiting_now',        (SELECT count(*) FROM sought s WHERE s.status = 'pending'),
  'waiting_over_24h',   (SELECT count(*) FROM sought s WHERE s.status = 'pending' AND s.pub < now() - interval '24 hours'),
  'open_requests',      (SELECT count(*) FROM public.loq_requests r WHERE r.status = 'pending'),
  'accepted_30d',       (SELECT count(*) FROM recent r WHERE r.accepted_at IS NOT NULL),
  'median_hours',       (SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY r.hours)::numeric, 1)
                           FROM recent r WHERE r.accepted_at IS NOT NULL),
  'p75_hours',          (SELECT round(percentile_cont(0.75) WITHIN GROUP (ORDER BY r.hours)::numeric, 1)
                           FROM recent r WHERE r.accepted_at IS NOT NULL),
  -- Only loqs whose first 24 h are over can be judged.
  'within_24h_base',    (SELECT count(*) FROM recent r WHERE r.pub < now() - interval '24 hours'),
  'within_24h',         (SELECT count(*) FROM recent r
                          WHERE r.pub < now() - interval '24 hours' AND r.accepted_at IS NOT NULL AND r.hours <= 24),
  'weekly', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'week', w.wk,
             'published', (SELECT count(*) FROM sought s
                            WHERE (date_trunc('week', s.pub AT TIME ZONE 'Europe/Bratislava'))::date = w.wk),
             'accepted',  (SELECT count(*) FROM sought s
                            WHERE s.accepted_at IS NOT NULL
                              AND (date_trunc('week', s.accepted_at AT TIME ZONE 'Europe/Bratislava'))::date = w.wk),
             'median_hours', (SELECT round(percentile_cont(0.5) WITHIN GROUP (
                                ORDER BY extract(epoch FROM (s.accepted_at - s.pub)) / 3600.0)::numeric, 1)
                               FROM sought s
                              WHERE s.accepted_at IS NOT NULL
                                AND (date_trunc('week', s.accepted_at AT TIME ZONE 'Europe/Bratislava'))::date = w.wk)
           ) ORDER BY w.wk), '[]'::jsonb)
      FROM weeks w
  ),
  'roles', jsonb_build_object(
    'loqee_registered',     (SELECT count(*) FROM public.profiles p WHERE NOT p.is_admin AND p.status = 'active' AND p.role = 'loqee'),
    'loqholder_registered', (SELECT count(*) FROM public.profiles p WHERE NOT p.is_admin AND p.status = 'active' AND p.role = 'loqholder'),
    'loqee_active_30d',     (SELECT count(*) FROM public.profiles p JOIN active_30d a ON a.user_id = p.id
                              WHERE NOT p.is_admin AND p.role = 'loqee'),
    'loqholder_active_30d', (SELECT count(*) FROM public.profiles p JOIN active_30d a ON a.user_id = p.id
                              WHERE NOT p.is_admin AND p.role = 'loqholder')
  )
);
$$;

-- function: admin_mrr()

CREATE FUNCTION public.admin_mrr() RETURNS TABLE(currency text, mrr bigint, subscriptions bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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

-- function: admin_retention_cohorts()

CREATE FUNCTION public.admin_retention_cohorts() RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO ''
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

-- function: admin_revenue_summary()

CREATE FUNCTION public.admin_revenue_summary() RETURNS TABLE(currency text, payments_count bigint, gross bigint, refunded bigint, fees bigint, gross_30d bigint, refunded_30d bigint, fees_30d bigint, gross_month bigint, refunded_month bigint, fees_month bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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

-- function: admin_signup_sources()

CREATE FUNCTION public.admin_signup_sources() RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
WITH
since AS (
  SELECT min(p.created_at) AS t
    FROM public.profiles p
   WHERE NOT p.is_admin
     AND (p.signup_referrer IS NOT NULL OR p.signup_utm_source IS NOT NULL
          OR p.signup_utm_medium IS NOT NULL OR p.signup_utm_campaign IS NOT NULL)
),
signups AS (
  SELECT p.signup_referrer, p.signup_utm_source, p.signup_utm_medium, p.signup_utm_campaign
    FROM public.profiles p, since s
   WHERE NOT p.is_admin AND s.t IS NOT NULL AND p.created_at >= s.t
),
referrers AS (
  SELECT x.signup_referrer AS referrer, count(*) AS users
    FROM signups x
   WHERE x.signup_referrer IS NOT NULL
   GROUP BY 1
),
campaigns AS (
  SELECT x.signup_utm_source AS source, x.signup_utm_medium AS medium, x.signup_utm_campaign AS campaign,
         count(*) AS users
    FROM signups x
   WHERE x.signup_utm_source IS NOT NULL OR x.signup_utm_medium IS NOT NULL OR x.signup_utm_campaign IS NOT NULL
   GROUP BY 1, 2, 3
)
SELECT jsonb_build_object(
  'since',     (SELECT (s.t AT TIME ZONE 'Europe/Bratislava')::date FROM since s),
  'signups',   (SELECT count(*) FROM signups),
  'no_source', (SELECT count(*) FROM signups x
                 WHERE x.signup_referrer IS NULL AND x.signup_utm_source IS NULL
                   AND x.signup_utm_medium IS NULL AND x.signup_utm_campaign IS NULL),
  'referrers', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.users DESC, r.referrer), '[]'::jsonb) FROM referrers r),
  'campaigns', (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.users DESC, c.source NULLS LAST), '[]'::jsonb)
                  FROM (SELECT * FROM campaigns ORDER BY users DESC LIMIT 20) c)
);
$$;

-- function: admin_source_quality()

CREATE FUNCTION public.admin_source_quality() RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
WITH
since AS (
  SELECT min(p.created_at) AS t
    FROM public.profiles p
   WHERE NOT p.is_admin
     AND (p.signup_referrer IS NOT NULL OR p.signup_utm_source IS NOT NULL
          OR p.signup_utm_medium IS NOT NULL OR p.signup_utm_campaign IS NOT NULL)
),
signups AS (
  SELECT p.id AS user_id,
         coalesce(p.signup_utm_source, p.signup_referrer) AS source,
         p.signup_utm_source IS NOT NULL AS tagged
    FROM public.profiles p, since s
   WHERE NOT p.is_admin AND s.t IS NOT NULL AND p.created_at >= s.t
),
used_loq AS (
  SELECT l.loqee_id AS user_id FROM public.loqs l WHERE l.accepted_at IS NOT NULL
  UNION
  SELECT l.loqholder_id FROM public.loqs l WHERE l.accepted_at IS NOT NULL AND l.loqholder_id IS NOT NULL
),
ever_paid AS (
  SELECT DISTINCT pm.user_id FROM public.payments pm WHERE pm.amount > 0 AND pm.user_id IS NOT NULL
),
paying_now AS (
  SELECT s.user_id FROM public.subscriptions s WHERE s.status IN ('active', 'past_due')
),
grouped AS (
  SELECT x.source,
         bool_or(x.tagged)                                                      AS tagged,
         count(*)                                                               AS signups,
         count(*) FILTER (WHERE x.user_id IN (SELECT user_id FROM used_loq))   AS used_loq,
         count(*) FILTER (WHERE x.user_id IN (SELECT user_id FROM ever_paid))  AS ever_paid,
         count(*) FILTER (WHERE x.user_id IN (SELECT user_id FROM paying_now)) AS paying_now
    FROM signups x
   GROUP BY x.source
)
SELECT jsonb_build_object(
  'since', (SELECT (s.t AT TIME ZONE 'Europe/Bratislava')::date FROM since s),
  -- Largest source first; "no source" (NULL) always last.
  'rows',  (SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.source IS NULL, g.signups DESC, g.source), '[]'::jsonb)
              FROM grouped g)
);
$$;

-- function: admin_subscription_trends()

CREATE FUNCTION public.admin_subscription_trends() RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO ''
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

-- function: auth_is_admin()

CREATE FUNCTION public.auth_is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_admin = true
  )
$$;

-- function: auth_is_super_admin()

CREATE FUNCTION public.auth_is_super_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND is_admin = true
      AND admin_level = 'super_admin'
  )
$$;

-- function: check_rate_limit(text, integer, bigint)

CREATE FUNCTION public.check_rate_limit(p_key text, p_max integer, p_window_ms bigint) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_now      TIMESTAMPTZ := NOW();
  v_reset_at TIMESTAMPTZ;
  v_count    INTEGER;
BEGIN
  SELECT count, reset_at INTO v_count, v_reset_at
  FROM rate_limit_buckets WHERE key = p_key;

  IF NOT FOUND OR v_reset_at <= v_now THEN
    INSERT INTO rate_limit_buckets(key, count, reset_at)
    VALUES (p_key, 1, v_now + (p_window_ms || ' milliseconds')::INTERVAL)
    ON CONFLICT (key) DO UPDATE
      SET count = 1, reset_at = v_now + (p_window_ms || ' milliseconds')::INTERVAL;
    RETURN TRUE;
  END IF;

  IF v_count >= p_max THEN
    RETURN FALSE;
  END IF;

  UPDATE rate_limit_buckets SET count = count + 1 WHERE key = p_key;
  RETURN TRUE;
END;
$$;

-- function: record_user_activity(uuid)

CREATE FUNCTION public.record_user_activity(p_user_id uuid) RETURNS void
    LANGUAGE sql
    SET search_path TO ''
    AS $$
  INSERT INTO public.user_activity_days AS a (user_id, day)
  VALUES (p_user_id, (now() AT TIME ZONE 'Europe/Bratislava')::date)
  ON CONFLICT (user_id, day) DO UPDATE SET
    heartbeats   = a.heartbeats + 1,
    sessions     = a.sessions + CASE WHEN now() - a.last_seen_at > interval '30 minutes' THEN 1 ELSE 0 END,
    last_seen_at = now();
$$;

-- function: update_updated_at()

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- table: profiles

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    display_name text,
    avatar_url text,
    bio text,
    subscription_status text DEFAULT 'inactive'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    leaderboard_opt_out boolean DEFAULT false NOT NULL,
    username text,
    last_seen_at timestamp with time zone,
    show_online_status boolean DEFAULT true NOT NULL,
    is_admin boolean DEFAULT false NOT NULL,
    admin_level text,
    terms_accepted_at timestamp with time zone,
    deleted_at timestamp with time zone,
    signup_country text,
    signup_region text,
    signup_timezone text,
    signup_locale text,
    signup_referrer text,
    signup_utm_source text,
    signup_utm_medium text,
    signup_utm_campaign text,
    hide_from_search boolean DEFAULT false NOT NULL,
    trial_ends_at timestamp with time zone DEFAULT (now() + '30 days'::interval),
    CONSTRAINT profiles_admin_level_check CHECK ((admin_level = ANY (ARRAY['super_admin'::text, 'support'::text, 'analyst'::text]))),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['loqee'::text, 'loqholder'::text, 'admin'::text]))),
    CONSTRAINT profiles_signup_country_check CHECK ((signup_country ~ '^[A-Z]{2}$'::text)),
    CONSTRAINT profiles_status_check CHECK ((status = ANY (ARRAY['active'::text, 'banned'::text, 'deleted'::text]))),
    CONSTRAINT profiles_subscription_status_check CHECK ((subscription_status = ANY (ARRAY['inactive'::text, 'active'::text]))),
    CONSTRAINT username_format CHECK (((username IS NULL) OR (username ~ '^[a-z][a-z0-9_]{2,19}$'::text)))
);

-- comment: COLUMN profiles.trial_ends_at

COMMENT ON COLUMN public.profiles.trial_ends_at IS 'End of the free trial. Premium access while now() < trial_ends_at, or while subscription_status = active.';

-- table: subscriptions

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    stripe_customer_id text NOT NULL,
    stripe_subscription_id text,
    status text DEFAULT 'inactive'::text NOT NULL,
    current_period_end timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cancel_at_period_end boolean DEFAULT false NOT NULL,
    plan_amount bigint,
    plan_interval text,
    plan_currency text,
    canceled_at timestamp with time zone,
    ended_at timestamp with time zone,
    CONSTRAINT subscriptions_plan_interval_check CHECK ((plan_interval = ANY (ARRAY['day'::text, 'week'::text, 'month'::text, 'year'::text]))),
    CONSTRAINT subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'past_due'::text, 'canceled'::text])))
);

-- view: admin_user_listing

CREATE VIEW public.admin_user_listing WITH (security_invoker='on') AS
 SELECT p.id,
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
            WHEN (s.user_id IS NULL) THEN 'none'::text
            WHEN (s.status = 'past_due'::text) THEN 'past_due'::text
            WHEN ((s.status = 'active'::text) AND s.cancel_at_period_end) THEN 'cancelling'::text
            WHEN (s.status = 'active'::text) THEN 'active'::text
            ELSE 'lapsed'::text
        END AS billing_status,
    s.cancel_at_period_end,
    s.current_period_end,
    p.signup_country,
    p.signup_region,
    p.signup_timezone,
    p.signup_locale
   FROM (public.profiles p
     LEFT JOIN public.subscriptions s ON ((s.user_id = p.id)));

-- table: audit_log

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action text NOT NULL,
    actor_id uuid,
    target_id uuid,
    details jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- table: conversations

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_a_id uuid NOT NULL,
    user_b_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone,
    last_message_at timestamp with time zone,
    CONSTRAINT conversations_distinct_users CHECK ((user_a_id <> user_b_id)),
    CONSTRAINT conversations_ordered_pair CHECK ((user_a_id < user_b_id)),
    CONSTRAINT conversations_requester_is_participant CHECK (((requested_by = user_a_id) OR (requested_by = user_b_id))),
    CONSTRAINT conversations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])))
);

-- table: dm_messages

CREATE TABLE public.dm_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dm_messages_content_check CHECK (((char_length(content) >= 1) AND (char_length(content) <= 5000)))
);

-- table: favorites

CREATE TABLE public.favorites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    favorited_profile_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT favorites_no_self CHECK ((user_id <> favorited_profile_id))
);

-- table: loq_requests

CREATE TABLE public.loq_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    loq_id uuid NOT NULL,
    loqholder_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone,
    CONSTRAINT loq_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'cancelled'::text, 'auto_rejected'::text])))
);

ALTER TABLE ONLY public.loq_requests REPLICA IDENTITY FULL;

-- table: loq_visitor_interactions

CREATE TABLE public.loq_visitor_interactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hours_added numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    loq_id uuid NOT NULL,
    public_link_id text NOT NULL,
    ip_hash text NOT NULL,
    direction text DEFAULT 'add'::text NOT NULL,
    loqee_id uuid,
    loqholder_id uuid,
    user_id uuid,
    CONSTRAINT loq_visitor_hours_positive CHECK ((hours_added > (0)::numeric)),
    CONSTRAINT loq_visitor_interactions_direction_check CHECK ((direction = ANY (ARRAY['add'::text, 'remove'::text])))
);

ALTER TABLE ONLY public.loq_visitor_interactions REPLICA IDENTITY FULL;

-- table: loqs

CREATE TABLE public.loqs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    loqee_id uuid NOT NULL,
    loqholder_id uuid,
    status text DEFAULT 'draft'::text NOT NULL,
    duration_minutes integer NOT NULL,
    combination_text text,
    combination_photo_url text,
    emotion text,
    reason text,
    is_public boolean DEFAULT false NOT NULL,
    loqed_until timestamp with time zone,
    locked boolean DEFAULT false NOT NULL,
    public_link_id text,
    visitor_add_hours numeric DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    accepted_at timestamp with time zone,
    ended_at timestamp with time zone,
    paused_at timestamp with time zone,
    combination_revealed_at timestamp with time zone,
    visitor_permission text DEFAULT 'both'::text NOT NULL,
    listed_in_discover boolean DEFAULT false NOT NULL,
    published_at timestamp with time zone,
    CONSTRAINT combination_required CHECK (((combination_text IS NOT NULL) OR (combination_photo_url IS NOT NULL))),
    CONSTRAINT loqs_duration_minutes_check CHECK (((duration_minutes >= 1) AND (duration_minutes <= ((3650 * 24) * 60)))),
    CONSTRAINT loqs_emotion_check CHECK (((emotion IS NULL) OR ((char_length(emotion) >= 1) AND (char_length(emotion) <= 16)))),
    CONSTRAINT loqs_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending'::text, 'active'::text, 'paused'::text, 'ended'::text, 'cancelled'::text]))),
    CONSTRAINT loqs_visitor_add_hours_check CHECK ((visitor_add_hours > (0)::numeric)),
    CONSTRAINT loqs_visitor_permission_check CHECK ((visitor_permission = ANY (ARRAY['none'::text, 'add'::text, 'remove'::text, 'both'::text]))),
    CONSTRAINT no_self_loq CHECK ((loqee_id <> loqholder_id))
);

ALTER TABLE ONLY public.loqs REPLICA IDENTITY FULL;

-- view: loqee_leaderboard

CREATE VIEW public.loqee_leaderboard AS
 SELECT p.id,
    COALESCE(p.display_name, 'Loqsy user'::text) AS display_name,
    round(max((EXTRACT(epoch FROM (l.loqed_until - l.created_at)) / (3600)::numeric)), 1) AS longest_loq_hours,
    p.avatar_url,
    p.username
   FROM (public.profiles p
     JOIN public.loqs l ON ((l.loqee_id = p.id)))
  WHERE ((l.status = 'ended'::text) AND (l.loqed_until IS NOT NULL) AND (l.loqholder_id IS NOT NULL) AND (p.status = 'active'::text) AND (p.leaderboard_opt_out = false))
  GROUP BY p.id, p.display_name, p.avatar_url, p.username
  ORDER BY (round(max((EXTRACT(epoch FROM (l.loqed_until - l.created_at)) / (3600)::numeric)), 1)) DESC
 LIMIT 100;

-- view: loqee_leaderboard_all

CREATE VIEW public.loqee_leaderboard_all AS
 SELECT p.id,
    COALESCE(p.display_name, 'Loqsy user'::text) AS display_name,
    round(max((EXTRACT(epoch FROM (l.loqed_until - l.created_at)) / (3600)::numeric)), 1) AS longest_loq_hours,
    p.avatar_url,
    p.username,
    (row_number() OVER (ORDER BY (max((EXTRACT(epoch FROM (l.loqed_until - l.created_at)) / (3600)::numeric))) DESC))::integer AS rank
   FROM (public.profiles p
     JOIN public.loqs l ON ((l.loqee_id = p.id)))
  WHERE ((l.status = 'ended'::text) AND (l.loqed_until IS NOT NULL) AND (l.loqholder_id IS NOT NULL) AND (p.status = 'active'::text) AND (p.leaderboard_opt_out = false))
  GROUP BY p.id, p.display_name, p.avatar_url, p.username;

-- view: loqholder_leaderboard

CREATE VIEW public.loqholder_leaderboard AS
 SELECT p.id,
    COALESCE(p.display_name, 'Loqsy user'::text) AS display_name,
    (count(l.id))::integer AS controlled_loqs,
    p.avatar_url,
    p.username
   FROM (public.profiles p
     JOIN public.loqs l ON ((l.loqholder_id = p.id)))
  WHERE ((l.status = 'ended'::text) AND (p.status = 'active'::text) AND (p.leaderboard_opt_out = false))
  GROUP BY p.id, p.display_name, p.avatar_url, p.username
  ORDER BY ((count(l.id))::integer) DESC
 LIMIT 100;

-- view: loqholder_leaderboard_all

CREATE VIEW public.loqholder_leaderboard_all AS
 SELECT p.id,
    COALESCE(p.display_name, 'Loqsy user'::text) AS display_name,
    (count(l.id))::integer AS controlled_loqs,
    p.avatar_url,
    p.username,
    (row_number() OVER (ORDER BY (count(l.id)) DESC))::integer AS rank
   FROM (public.profiles p
     JOIN public.loqs l ON ((l.loqholder_id = p.id)))
  WHERE ((l.status = 'ended'::text) AND (p.status = 'active'::text) AND (p.leaderboard_opt_out = false))
  GROUP BY p.id, p.display_name, p.avatar_url, p.username;

-- table: messages

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    loq_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    loqee_id uuid,
    loqholder_id uuid,
    CONSTRAINT messages_content_check CHECK (((char_length(content) >= 1) AND (char_length(content) <= 5000)))
);

ALTER TABLE ONLY public.messages REPLICA IDENTITY FULL;

-- table: payments

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stripe_charge_id text NOT NULL,
    stripe_invoice_id text,
    stripe_customer_id text,
    user_id uuid,
    amount bigint NOT NULL,
    amount_refunded bigint DEFAULT 0 NOT NULL,
    fee bigint DEFAULT 0 NOT NULL,
    currency text NOT NULL,
    paid_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payments_amount_check CHECK ((amount >= 0)),
    CONSTRAINT payments_amount_refunded_check CHECK ((amount_refunded >= 0)),
    CONSTRAINT payments_fee_check CHECK ((fee >= 0))
);

-- table: push_subscriptions

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- table: rate_limit_buckets

CREATE TABLE public.rate_limit_buckets (
    key text NOT NULL,
    count integer DEFAULT 1 NOT NULL,
    reset_at timestamp with time zone NOT NULL
);

-- table: reports

CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reported_user_id uuid NOT NULL,
    reported_by_id uuid NOT NULL,
    reason text NOT NULL,
    description text,
    status text DEFAULT 'open'::text,
    created_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone,
    conversation_id uuid,
    CONSTRAINT reports_status_check CHECK ((status = ANY (ARRAY['open'::text, 'dismissed'::text, 'resolved'::text])))
);

-- table: security_reports

CREATE TABLE public.security_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    message text NOT NULL,
    contact text,
    user_agent text,
    ip text,
    handled_at timestamp with time zone,
    handled_by uuid,
    admin_note text,
    kind text DEFAULT 'security'::text NOT NULL,
    source text DEFAULT 'form'::text NOT NULL,
    source_detail text,
    reporter_id uuid,
    CONSTRAINT security_reports_kind_check CHECK ((kind = ANY (ARRAY['bug'::text, 'security'::text, 'other'::text]))),
    CONSTRAINT security_reports_source_check CHECK ((source = ANY (ARRAY['form'::text, 'account_deletion'::text])))
);

-- table: user_activity_days

CREATE TABLE public.user_activity_days (
    user_id uuid NOT NULL,
    day date NOT NULL,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    heartbeats integer DEFAULT 1 NOT NULL,
    sessions integer DEFAULT 1 NOT NULL
);

-- constraint: audit_log audit_log_pkey

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);

-- constraint: conversations conversations_pkey

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);

-- constraint: conversations conversations_user_a_id_user_b_id_key

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_a_id_user_b_id_key UNIQUE (user_a_id, user_b_id);

-- constraint: dm_messages dm_messages_pkey

ALTER TABLE ONLY public.dm_messages
    ADD CONSTRAINT dm_messages_pkey PRIMARY KEY (id);

-- constraint: favorites favorites_pkey

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (id);

-- constraint: favorites favorites_user_id_favorited_profile_id_key

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_favorited_profile_id_key UNIQUE (user_id, favorited_profile_id);

-- constraint: loq_requests loq_requests_loq_id_loqholder_id_key

ALTER TABLE ONLY public.loq_requests
    ADD CONSTRAINT loq_requests_loq_id_loqholder_id_key UNIQUE (loq_id, loqholder_id);

-- constraint: loq_requests loq_requests_pkey

ALTER TABLE ONLY public.loq_requests
    ADD CONSTRAINT loq_requests_pkey PRIMARY KEY (id);

-- constraint: loq_visitor_interactions loq_visitor_interactions_pkey

ALTER TABLE ONLY public.loq_visitor_interactions
    ADD CONSTRAINT loq_visitor_interactions_pkey PRIMARY KEY (id);

-- constraint: loqs loqs_pkey

ALTER TABLE ONLY public.loqs
    ADD CONSTRAINT loqs_pkey PRIMARY KEY (id);

-- constraint: loqs loqs_public_link_id_key

ALTER TABLE ONLY public.loqs
    ADD CONSTRAINT loqs_public_link_id_key UNIQUE (public_link_id);

-- constraint: messages messages_pkey

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);

-- constraint: payments payments_pkey

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);

-- constraint: payments payments_stripe_charge_id_key

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_stripe_charge_id_key UNIQUE (stripe_charge_id);

-- constraint: profiles profiles_pkey

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

-- constraint: profiles profiles_username_key

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);

-- constraint: push_subscriptions push_subscriptions_endpoint_key

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);

-- constraint: push_subscriptions push_subscriptions_pkey

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);

-- constraint: rate_limit_buckets rate_limit_buckets_pkey

ALTER TABLE ONLY public.rate_limit_buckets
    ADD CONSTRAINT rate_limit_buckets_pkey PRIMARY KEY (key);

-- constraint: reports reports_pkey

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);

-- constraint: security_reports security_reports_pkey

ALTER TABLE ONLY public.security_reports
    ADD CONSTRAINT security_reports_pkey PRIMARY KEY (id);

-- constraint: subscriptions subscriptions_pkey

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);

-- constraint: subscriptions subscriptions_stripe_customer_id_key

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_stripe_customer_id_key UNIQUE (stripe_customer_id);

-- constraint: subscriptions subscriptions_stripe_subscription_id_key

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);

-- constraint: subscriptions subscriptions_user_id_key

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);

-- constraint: user_activity_days user_activity_days_pkey

ALTER TABLE ONLY public.user_activity_days
    ADD CONSTRAINT user_activity_days_pkey PRIMARY KEY (user_id, day);

-- index: idx_conversations_user_a

CREATE INDEX idx_conversations_user_a ON public.conversations USING btree (user_a_id);

-- index: idx_conversations_user_b

CREATE INDEX idx_conversations_user_b ON public.conversations USING btree (user_b_id);

-- index: idx_dm_messages_conversation

CREATE INDEX idx_dm_messages_conversation ON public.dm_messages USING btree (conversation_id, created_at DESC);

-- index: idx_favorites_favorited

CREATE INDEX idx_favorites_favorited ON public.favorites USING btree (favorited_profile_id);

-- index: idx_favorites_user

CREATE INDEX idx_favorites_user ON public.favorites USING btree (user_id);

-- index: idx_loq_requests_loq

CREATE INDEX idx_loq_requests_loq ON public.loq_requests USING btree (loq_id);

-- index: idx_loq_requests_loqholder

CREATE INDEX idx_loq_requests_loqholder ON public.loq_requests USING btree (loqholder_id);

-- index: idx_loq_requests_one_pending_per_loq

CREATE UNIQUE INDEX idx_loq_requests_one_pending_per_loq ON public.loq_requests USING btree (loq_id) WHERE (status = 'pending'::text);

-- index: idx_loq_requests_pending

CREATE INDEX idx_loq_requests_pending ON public.loq_requests USING btree (loqholder_id, status) WHERE (status = 'pending'::text);

-- index: idx_loq_visitor_interactions_rate_limit

CREATE INDEX idx_loq_visitor_interactions_rate_limit ON public.loq_visitor_interactions USING btree (loq_id, ip_hash, created_at DESC);

-- index: idx_loq_visitor_interactions_user_rate_limit

CREATE INDEX idx_loq_visitor_interactions_user_rate_limit ON public.loq_visitor_interactions USING btree (loq_id, user_id, created_at DESC) WHERE (user_id IS NOT NULL);

-- index: idx_loq_visitor_ip

CREATE INDEX idx_loq_visitor_ip ON public.loq_visitor_interactions USING btree (ip_hash, created_at DESC);

-- index: idx_loq_visitor_loq

CREATE INDEX idx_loq_visitor_loq ON public.loq_visitor_interactions USING btree (loq_id);

-- index: idx_loq_visitor_loqee

CREATE INDEX idx_loq_visitor_loqee ON public.loq_visitor_interactions USING btree (loqee_id);

-- index: idx_loq_visitor_loqholder

CREATE INDEX idx_loq_visitor_loqholder ON public.loq_visitor_interactions USING btree (loqholder_id);

-- index: idx_loqs_discover

CREATE INDEX idx_loqs_discover ON public.loqs USING btree (listed_in_discover, status, created_at DESC) WHERE listed_in_discover;

-- index: idx_loqs_loqee

CREATE INDEX idx_loqs_loqee ON public.loqs USING btree (loqee_id);

-- index: idx_loqs_loqholder

CREATE INDEX idx_loqs_loqholder ON public.loqs USING btree (loqholder_id);

-- index: idx_loqs_public_link

CREATE INDEX idx_loqs_public_link ON public.loqs USING btree (public_link_id) WHERE (public_link_id IS NOT NULL);

-- index: idx_loqs_status

CREATE INDEX idx_loqs_status ON public.loqs USING btree (status);

-- index: idx_messages_loq

CREATE INDEX idx_messages_loq ON public.messages USING btree (loq_id, created_at DESC);

-- index: idx_messages_loqee_id

CREATE INDEX idx_messages_loqee_id ON public.messages USING btree (loqee_id);

-- index: idx_messages_loqholder_id

CREATE INDEX idx_messages_loqholder_id ON public.messages USING btree (loqholder_id);

-- index: idx_payments_paid_at

CREATE INDEX idx_payments_paid_at ON public.payments USING btree (paid_at DESC);

-- index: idx_payments_user

CREATE INDEX idx_payments_user ON public.payments USING btree (user_id);

-- index: idx_rate_limit_reset

CREATE INDEX idx_rate_limit_reset ON public.rate_limit_buckets USING btree (reset_at);

-- index: idx_reports_conversation

CREATE INDEX idx_reports_conversation ON public.reports USING btree (conversation_id);

-- index: idx_security_reports_open

CREATE INDEX idx_security_reports_open ON public.security_reports USING btree (created_at DESC) WHERE (handled_at IS NULL);

-- index: idx_user_activity_days_day

CREATE INDEX idx_user_activity_days_day ON public.user_activity_days USING btree (day);

-- index: loqs_one_active_per_loqee

CREATE UNIQUE INDEX loqs_one_active_per_loqee ON public.loqs USING btree (loqee_id) WHERE (status = ANY (ARRAY['draft'::text, 'pending'::text, 'active'::text, 'paused'::text]));

-- index: push_subscriptions_user_id_idx

CREATE INDEX push_subscriptions_user_id_idx ON public.push_subscriptions USING btree (user_id);

-- trigger: payments payments_updated_at

CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- trigger: subscriptions subscriptions_updated_at

CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- fk constraint: audit_log audit_log_actor_id_fkey

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id);

-- fk constraint: audit_log audit_log_target_id_fkey

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_target_id_fkey FOREIGN KEY (target_id) REFERENCES public.profiles(id);

-- fk constraint: conversations conversations_requested_by_fkey

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.profiles(id);

-- fk constraint: conversations conversations_user_a_id_fkey

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_a_id_fkey FOREIGN KEY (user_a_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- fk constraint: conversations conversations_user_b_id_fkey

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_b_id_fkey FOREIGN KEY (user_b_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- fk constraint: dm_messages dm_messages_conversation_id_fkey

ALTER TABLE ONLY public.dm_messages
    ADD CONSTRAINT dm_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

-- fk constraint: dm_messages dm_messages_sender_id_fkey

ALTER TABLE ONLY public.dm_messages
    ADD CONSTRAINT dm_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id);

-- fk constraint: favorites favorites_favorited_profile_id_fkey

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_favorited_profile_id_fkey FOREIGN KEY (favorited_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- fk constraint: favorites favorites_user_id_fkey

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- fk constraint: loq_requests loq_requests_loq_id_fkey

ALTER TABLE ONLY public.loq_requests
    ADD CONSTRAINT loq_requests_loq_id_fkey FOREIGN KEY (loq_id) REFERENCES public.loqs(id) ON DELETE CASCADE;

-- fk constraint: loq_requests loq_requests_loqholder_id_fkey

ALTER TABLE ONLY public.loq_requests
    ADD CONSTRAINT loq_requests_loqholder_id_fkey FOREIGN KEY (loqholder_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- fk constraint: loq_visitor_interactions loq_visitor_interactions_loq_id_fkey

ALTER TABLE ONLY public.loq_visitor_interactions
    ADD CONSTRAINT loq_visitor_interactions_loq_id_fkey FOREIGN KEY (loq_id) REFERENCES public.loqs(id) ON DELETE CASCADE;

-- fk constraint: loq_visitor_interactions loq_visitor_interactions_loqee_id_fkey

ALTER TABLE ONLY public.loq_visitor_interactions
    ADD CONSTRAINT loq_visitor_interactions_loqee_id_fkey FOREIGN KEY (loqee_id) REFERENCES public.profiles(id);

-- fk constraint: loq_visitor_interactions loq_visitor_interactions_loqholder_id_fkey

ALTER TABLE ONLY public.loq_visitor_interactions
    ADD CONSTRAINT loq_visitor_interactions_loqholder_id_fkey FOREIGN KEY (loqholder_id) REFERENCES public.profiles(id);

-- fk constraint: loq_visitor_interactions loq_visitor_interactions_user_id_fkey

ALTER TABLE ONLY public.loq_visitor_interactions
    ADD CONSTRAINT loq_visitor_interactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- fk constraint: loqs loqs_loqee_id_fkey

ALTER TABLE ONLY public.loqs
    ADD CONSTRAINT loqs_loqee_id_fkey FOREIGN KEY (loqee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- fk constraint: loqs loqs_loqholder_id_fkey

ALTER TABLE ONLY public.loqs
    ADD CONSTRAINT loqs_loqholder_id_fkey FOREIGN KEY (loqholder_id) REFERENCES public.profiles(id);

-- fk constraint: messages messages_loq_id_fkey

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_loq_id_fkey FOREIGN KEY (loq_id) REFERENCES public.loqs(id) ON DELETE CASCADE NOT VALID;

-- fk constraint: messages messages_loqee_id_fkey

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_loqee_id_fkey FOREIGN KEY (loqee_id) REFERENCES public.profiles(id);

-- fk constraint: messages messages_loqholder_id_fkey

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_loqholder_id_fkey FOREIGN KEY (loqholder_id) REFERENCES public.profiles(id);

-- fk constraint: messages messages_sender_id_fkey

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id);

-- fk constraint: payments payments_user_id_fkey

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- fk constraint: profiles profiles_id_fkey

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- fk constraint: push_subscriptions push_subscriptions_user_id_fkey

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- fk constraint: reports reports_conversation_id_fkey

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;

-- fk constraint: reports reports_reported_by_id_fkey

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reported_by_id_fkey FOREIGN KEY (reported_by_id) REFERENCES public.profiles(id);

-- fk constraint: reports reports_reported_user_id_fkey

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reported_user_id_fkey FOREIGN KEY (reported_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- fk constraint: security_reports security_reports_handled_by_fkey

ALTER TABLE ONLY public.security_reports
    ADD CONSTRAINT security_reports_handled_by_fkey FOREIGN KEY (handled_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- fk constraint: security_reports security_reports_reporter_id_fkey

ALTER TABLE ONLY public.security_reports
    ADD CONSTRAINT security_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- fk constraint: subscriptions subscriptions_user_id_fkey

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- fk constraint: user_activity_days user_activity_days_user_id_fkey

ALTER TABLE ONLY public.user_activity_days
    ADD CONSTRAINT user_activity_days_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- policy: reports Admin reads reports

CREATE POLICY "Admin reads reports" ON public.reports FOR SELECT USING (public.auth_is_admin());

-- policy: reports Admin updates reports

CREATE POLICY "Admin updates reports" ON public.reports FOR UPDATE USING (public.auth_is_admin());

-- policy: audit_log Super admin reads audit log

CREATE POLICY "Super admin reads audit log" ON public.audit_log FOR SELECT USING (public.auth_is_super_admin());

-- policy: reports Users can submit reports

CREATE POLICY "Users can submit reports" ON public.reports FOR INSERT WITH CHECK ((reported_by_id = auth.uid()));

-- policy: profiles admin_read_all_profiles

CREATE POLICY admin_read_all_profiles ON public.profiles FOR SELECT USING (public.auth_is_admin());

-- policy: messages admin_reads_all_messages

CREATE POLICY admin_reads_all_messages ON public.messages FOR SELECT USING (public.auth_is_admin());

-- policy: subscriptions admin_reads_all_subscriptions

CREATE POLICY admin_reads_all_subscriptions ON public.subscriptions FOR SELECT USING (public.auth_is_admin());

-- row security: audit_log

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- row security: conversations

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- policy: conversations conversations_admin_read

CREATE POLICY conversations_admin_read ON public.conversations FOR SELECT USING (public.auth_is_admin());

-- policy: conversations conversations_insert_participant

CREATE POLICY conversations_insert_participant ON public.conversations FOR INSERT WITH CHECK (((auth.uid() = requested_by) AND ((auth.uid() = user_a_id) OR (auth.uid() = user_b_id))));

-- policy: conversations conversations_read_participants

CREATE POLICY conversations_read_participants ON public.conversations FOR SELECT USING (((auth.uid() = user_a_id) OR (auth.uid() = user_b_id)));

-- policy: conversations conversations_update_participants

CREATE POLICY conversations_update_participants ON public.conversations FOR UPDATE USING (((auth.uid() = user_a_id) OR (auth.uid() = user_b_id)));

-- row security: dm_messages

ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;

-- policy: dm_messages dm_messages_admin_read

CREATE POLICY dm_messages_admin_read ON public.dm_messages FOR SELECT USING (public.auth_is_admin());

-- policy: dm_messages dm_messages_insert_own

CREATE POLICY dm_messages_insert_own ON public.dm_messages FOR INSERT WITH CHECK ((sender_id = auth.uid()));

-- policy: dm_messages dm_messages_read_participants

CREATE POLICY dm_messages_read_participants ON public.dm_messages FOR SELECT USING ((auth.uid() IN ( SELECT conversations.user_a_id
   FROM public.conversations
  WHERE (conversations.id = dm_messages.conversation_id)
UNION
 SELECT conversations.user_b_id
   FROM public.conversations
  WHERE (conversations.id = dm_messages.conversation_id))));

-- row security: favorites

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- policy: favorites favorites_delete_own

CREATE POLICY favorites_delete_own ON public.favorites FOR DELETE USING ((auth.uid() = user_id));

-- policy: favorites favorites_insert_own

CREATE POLICY favorites_insert_own ON public.favorites FOR INSERT WITH CHECK ((auth.uid() = user_id));

-- policy: favorites favorites_read_own

CREATE POLICY favorites_read_own ON public.favorites FOR SELECT USING ((auth.uid() = user_id));

-- row security: loq_requests

ALTER TABLE public.loq_requests ENABLE ROW LEVEL SECURITY;

-- policy: loq_requests loq_requests_admin_read

CREATE POLICY loq_requests_admin_read ON public.loq_requests FOR SELECT USING (public.auth_is_admin());

-- policy: loq_requests loq_requests_read

CREATE POLICY loq_requests_read ON public.loq_requests FOR SELECT USING (((loqholder_id = auth.uid()) OR (loq_id IN ( SELECT loqs.id
   FROM public.loqs
  WHERE (loqs.loqee_id = auth.uid())))));

-- row security: loq_visitor_interactions

ALTER TABLE public.loq_visitor_interactions ENABLE ROW LEVEL SECURITY;

-- row security: loqs

ALTER TABLE public.loqs ENABLE ROW LEVEL SECURITY;

-- policy: loqs loqs_admin_read

CREATE POLICY loqs_admin_read ON public.loqs FOR SELECT USING (public.auth_is_admin());

-- policy: loqs loqs_admin_update

CREATE POLICY loqs_admin_update ON public.loqs FOR UPDATE USING (public.auth_is_admin());

-- policy: loqs loqs_read_participants

CREATE POLICY loqs_read_participants ON public.loqs FOR SELECT USING (((loqee_id = auth.uid()) OR (loqholder_id = auth.uid())));

-- row security: messages

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- policy: profiles own_profile_read

CREATE POLICY own_profile_read ON public.profiles FOR SELECT USING ((auth.uid() = id));

-- policy: subscriptions own_subscription_read

CREATE POLICY own_subscription_read ON public.subscriptions FOR SELECT USING ((user_id = auth.uid()));

-- row security: payments

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- row security: profiles

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- row security: push_subscriptions

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- row security: rate_limit_buckets

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- row security: reports

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- row security: security_reports

ALTER TABLE public.security_reports ENABLE ROW LEVEL SECURITY;

-- policy: messages see_own_messages

CREATE POLICY see_own_messages ON public.messages FOR SELECT USING (((loqee_id = auth.uid()) OR (loqholder_id = auth.uid())));

-- row security: subscriptions

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- row security: user_activity_days

ALTER TABLE public.user_activity_days ENABLE ROW LEVEL SECURITY;

-- policy: push_subscriptions users manage own push subscriptions

CREATE POLICY "users manage own push subscriptions" ON public.push_subscriptions USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

-- policy: loq_visitor_interactions visitor_interactions_read_participants

CREATE POLICY visitor_interactions_read_participants ON public.loq_visitor_interactions FOR SELECT USING (((loqee_id = auth.uid()) OR (loqholder_id = auth.uid())));

-- ─── Privileges ───────────────────────────────────────────────────────────
-- Supabase grants ALL on every new public object to anon, authenticated and
-- service_role by default. Start from nothing and grant exactly what is needed.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, service_role;

-- acl: SCHEMA public

GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- acl: FUNCTION adjust_visitor_time(p_loq_id uuid, p_delta_hours numeric, p_min_until timestamp with time zone, p_max_until timestamp with time zone)

GRANT ALL ON FUNCTION public.adjust_visitor_time(p_loq_id uuid, p_delta_hours numeric, p_min_until timestamp with time zone, p_max_until timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.adjust_visitor_time(p_loq_id uuid, p_delta_hours numeric, p_min_until timestamp with time zone, p_max_until timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.adjust_visitor_time(p_loq_id uuid, p_delta_hours numeric, p_min_until timestamp with time zone, p_max_until timestamp with time zone) TO service_role;

-- acl: FUNCTION admin_activity_days()

REVOKE ALL ON FUNCTION public.admin_activity_days() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_activity_days() TO service_role;

-- acl: FUNCTION admin_auth_activity()

REVOKE ALL ON FUNCTION public.admin_auth_activity() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_auth_activity() TO service_role;

-- acl: FUNCTION admin_churn_reasons()

REVOKE ALL ON FUNCTION public.admin_churn_reasons() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_churn_reasons() TO service_role;

-- acl: FUNCTION admin_kpi()

REVOKE ALL ON FUNCTION public.admin_kpi() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_kpi() TO service_role;

-- acl: FUNCTION admin_marketplace()

REVOKE ALL ON FUNCTION public.admin_marketplace() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_marketplace() TO service_role;

-- acl: FUNCTION admin_mrr()

REVOKE ALL ON FUNCTION public.admin_mrr() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_mrr() TO service_role;

-- acl: FUNCTION admin_retention_cohorts()

REVOKE ALL ON FUNCTION public.admin_retention_cohorts() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_retention_cohorts() TO service_role;

-- acl: FUNCTION admin_revenue_summary()

REVOKE ALL ON FUNCTION public.admin_revenue_summary() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_revenue_summary() TO service_role;

-- acl: FUNCTION admin_signup_sources()

REVOKE ALL ON FUNCTION public.admin_signup_sources() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_signup_sources() TO service_role;

-- acl: FUNCTION admin_source_quality()

REVOKE ALL ON FUNCTION public.admin_source_quality() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_source_quality() TO service_role;

-- acl: FUNCTION admin_subscription_trends()

REVOKE ALL ON FUNCTION public.admin_subscription_trends() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_subscription_trends() TO service_role;

-- acl: FUNCTION auth_is_admin()

GRANT ALL ON FUNCTION public.auth_is_admin() TO anon;
GRANT ALL ON FUNCTION public.auth_is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.auth_is_admin() TO service_role;

-- acl: FUNCTION auth_is_super_admin()

GRANT ALL ON FUNCTION public.auth_is_super_admin() TO anon;
GRANT ALL ON FUNCTION public.auth_is_super_admin() TO authenticated;
GRANT ALL ON FUNCTION public.auth_is_super_admin() TO service_role;

-- acl: FUNCTION check_rate_limit(p_key text, p_max integer, p_window_ms bigint)

GRANT ALL ON FUNCTION public.check_rate_limit(p_key text, p_max integer, p_window_ms bigint) TO anon;
GRANT ALL ON FUNCTION public.check_rate_limit(p_key text, p_max integer, p_window_ms bigint) TO authenticated;
GRANT ALL ON FUNCTION public.check_rate_limit(p_key text, p_max integer, p_window_ms bigint) TO service_role;

-- acl: FUNCTION record_user_activity(p_user_id uuid)

REVOKE ALL ON FUNCTION public.record_user_activity(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_user_activity(p_user_id uuid) TO service_role;

-- acl: FUNCTION update_updated_at()

GRANT ALL ON FUNCTION public.update_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at() TO service_role;

-- acl: TABLE profiles

GRANT REFERENCES,TRIGGER,TRUNCATE ON TABLE public.profiles TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

-- acl: TABLE subscriptions

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.subscriptions TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.subscriptions TO authenticated;
GRANT ALL ON TABLE public.subscriptions TO service_role;

-- acl: TABLE admin_user_listing

GRANT ALL ON TABLE public.admin_user_listing TO service_role;

-- acl: TABLE audit_log

GRANT ALL ON TABLE public.audit_log TO service_role;

-- acl: TABLE conversations

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.conversations TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.conversations TO authenticated;
GRANT ALL ON TABLE public.conversations TO service_role;

-- acl: TABLE dm_messages

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.dm_messages TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.dm_messages TO authenticated;
GRANT ALL ON TABLE public.dm_messages TO service_role;

-- acl: TABLE favorites

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.favorites TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.favorites TO authenticated;
GRANT ALL ON TABLE public.favorites TO service_role;

-- acl: TABLE loq_requests

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.loq_requests TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.loq_requests TO authenticated;
GRANT ALL ON TABLE public.loq_requests TO service_role;

-- acl: TABLE loq_visitor_interactions

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.loq_visitor_interactions TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.loq_visitor_interactions TO authenticated;
GRANT ALL ON TABLE public.loq_visitor_interactions TO service_role;

-- acl: TABLE loqs

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.loqs TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.loqs TO authenticated;
GRANT ALL ON TABLE public.loqs TO service_role;

-- acl: TABLE loqee_leaderboard

GRANT ALL ON TABLE public.loqee_leaderboard TO anon;
GRANT ALL ON TABLE public.loqee_leaderboard TO authenticated;
GRANT ALL ON TABLE public.loqee_leaderboard TO service_role;

-- acl: TABLE loqee_leaderboard_all

GRANT ALL ON TABLE public.loqee_leaderboard_all TO anon;
GRANT ALL ON TABLE public.loqee_leaderboard_all TO authenticated;
GRANT ALL ON TABLE public.loqee_leaderboard_all TO service_role;

-- acl: TABLE loqholder_leaderboard

GRANT ALL ON TABLE public.loqholder_leaderboard TO anon;
GRANT ALL ON TABLE public.loqholder_leaderboard TO authenticated;
GRANT ALL ON TABLE public.loqholder_leaderboard TO service_role;

-- acl: TABLE loqholder_leaderboard_all

GRANT ALL ON TABLE public.loqholder_leaderboard_all TO anon;
GRANT ALL ON TABLE public.loqholder_leaderboard_all TO authenticated;
GRANT ALL ON TABLE public.loqholder_leaderboard_all TO service_role;

-- acl: TABLE messages

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.messages TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.messages TO authenticated;
GRANT ALL ON TABLE public.messages TO service_role;

-- acl: TABLE payments

GRANT ALL ON TABLE public.payments TO service_role;

-- acl: TABLE push_subscriptions

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.push_subscriptions TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.push_subscriptions TO authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;

-- acl: TABLE rate_limit_buckets

GRANT ALL ON TABLE public.rate_limit_buckets TO anon;
GRANT ALL ON TABLE public.rate_limit_buckets TO authenticated;
GRANT ALL ON TABLE public.rate_limit_buckets TO service_role;

-- acl: TABLE reports

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.reports TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE public.reports TO authenticated;
GRANT ALL ON TABLE public.reports TO service_role;

-- acl: TABLE security_reports

GRANT ALL ON TABLE public.security_reports TO service_role;

-- acl: TABLE user_activity_days

GRANT ALL ON TABLE public.user_activity_days TO service_role;

-- default acl: DEFAULT PRIVILEGES FOR SEQUENCES

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

-- default acl: DEFAULT PRIVILEGES FOR FUNCTIONS

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

-- default acl: DEFAULT PRIVILEGES FOR TABLES

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;

--
--

-- Server-only RPCs. adjust_visitor_time is SECURITY DEFINER and takes the
-- bounds as arguments, so anyone able to call it could set any lock's end
-- time; check_rate_limit is internal too. Only the service role (server
-- routes) may execute them.
REVOKE EXECUTE ON FUNCTION public.adjust_visitor_time(uuid, numeric, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit FROM PUBLIC, anon, authenticated;

-- ─── Storage ──────────────────────────────────────────────────────────────
-- combination-photos is private (signed URLs only); avatars are public.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('combination-photos', 'combination-photos', false, 5242880, ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']),
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY admins_manage_avatars ON storage.objects AS PERMISSIVE FOR ALL TO authenticated
  USING (((bucket_id = 'avatars'::text) AND public.auth_is_admin()))
  WITH CHECK (((bucket_id = 'avatars'::text) AND public.auth_is_admin()));
CREATE POLICY admins_manage_combination_photos ON storage.objects AS PERMISSIVE FOR ALL TO authenticated
  USING (((bucket_id = 'combination-photos'::text) AND public.auth_is_admin()))
  WITH CHECK (((bucket_id = 'combination-photos'::text) AND public.auth_is_admin()));
CREATE POLICY loqees_delete_own_combination_photos ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'combination-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY loqees_upload_combination_photos ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'combination-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND (( SELECT profiles.role
   FROM public.profiles
  WHERE (profiles.id = auth.uid())) = 'loqee'::text)));
CREATE POLICY users_delete_own_avatar ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY users_upload_own_avatar ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

-- ─── Realtime ─────────────────────────────────────────────────────────────
-- Live updates are sent with server-side Broadcast; these tables are in the
-- publication so RLS-checked postgres_changes keep working where used.
ALTER PUBLICATION supabase_realtime ADD TABLE public.loqs, public.loq_requests, public.messages, public.loq_visitor_interactions;
