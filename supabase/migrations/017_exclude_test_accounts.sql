-- Internal accounts (admins + test/staff mailboxes) are excluded from the
-- admin statistics. Admins were already excluded via is_admin; test accounts
-- are recognised by their e-mail domain. To change the list of domains, drop
-- and re-add the column below (a generated column cannot be altered in place).

ALTER TABLE public.profiles
  ADD COLUMN is_test_account boolean
  GENERATED ALWAYS AS (email ~* '@(test\.sk|chasthub\.sk)$') STORED;

COMMENT ON COLUMN public.profiles.is_test_account IS 'True for e-mails ending in @test.sk or @chasthub.sk. Excluded from admin statistics, like is_admin.';

-- The admin_* functions below are 001 verbatim, with `NOT p.is_admin`
-- widened to also exclude test accounts.

-- function: admin_activity_days()

CREATE OR REPLACE FUNCTION public.admin_activity_days() RETURNS TABLE(user_id uuid, d date)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
WITH
users AS (
  SELECT p.id FROM public.profiles p
   WHERE NOT p.is_admin AND NOT p.is_test_account
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

-- function: admin_kpi()

CREATE OR REPLACE FUNCTION public.admin_kpi() RETURNS jsonb
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
   WHERE NOT p.is_admin AND NOT p.is_test_account
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

CREATE OR REPLACE FUNCTION public.admin_marketplace() RETURNS jsonb
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
    'loqee_registered',     (SELECT count(*) FROM public.profiles p WHERE NOT p.is_admin AND NOT p.is_test_account AND p.status = 'active' AND p.role = 'loqee'),
    'loqholder_registered', (SELECT count(*) FROM public.profiles p WHERE NOT p.is_admin AND NOT p.is_test_account AND p.status = 'active' AND p.role = 'loqholder'),
    'loqee_active_30d',     (SELECT count(*) FROM public.profiles p JOIN active_30d a ON a.user_id = p.id
                              WHERE NOT p.is_admin AND NOT p.is_test_account AND p.role = 'loqee'),
    'loqholder_active_30d', (SELECT count(*) FROM public.profiles p JOIN active_30d a ON a.user_id = p.id
                              WHERE NOT p.is_admin AND NOT p.is_test_account AND p.role = 'loqholder')
  )
);
$$;

-- function: admin_retention_cohorts()

CREATE OR REPLACE FUNCTION public.admin_retention_cohorts() RETURNS jsonb
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
   WHERE NOT p.is_admin AND NOT p.is_test_account
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

-- function: admin_signup_sources()

CREATE OR REPLACE FUNCTION public.admin_signup_sources() RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
WITH
since AS (
  SELECT min(p.created_at) AS t
    FROM public.profiles p
   WHERE NOT p.is_admin AND NOT p.is_test_account
     AND (p.signup_referrer IS NOT NULL OR p.signup_utm_source IS NOT NULL
          OR p.signup_utm_medium IS NOT NULL OR p.signup_utm_campaign IS NOT NULL)
),
signups AS (
  SELECT p.signup_referrer, p.signup_utm_source, p.signup_utm_medium, p.signup_utm_campaign
    FROM public.profiles p, since s
   WHERE NOT p.is_admin AND NOT p.is_test_account AND s.t IS NOT NULL AND p.created_at >= s.t
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

CREATE OR REPLACE FUNCTION public.admin_source_quality() RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
WITH
since AS (
  SELECT min(p.created_at) AS t
    FROM public.profiles p
   WHERE NOT p.is_admin AND NOT p.is_test_account
     AND (p.signup_referrer IS NOT NULL OR p.signup_utm_source IS NOT NULL
          OR p.signup_utm_medium IS NOT NULL OR p.signup_utm_campaign IS NOT NULL)
),
signups AS (
  SELECT p.id AS user_id,
         coalesce(p.signup_utm_source, p.signup_referrer) AS source,
         p.signup_utm_source IS NOT NULL AS tagged
    FROM public.profiles p, since s
   WHERE NOT p.is_admin AND NOT p.is_test_account AND s.t IS NOT NULL AND p.created_at >= s.t
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

