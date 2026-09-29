-- TASK-160: product KPIs for the super-admin dashboard — DAU, D1/D3
-- retention, how many people used a loq, new subscribers, sessions per user.
--
-- Nothing recorded "this user had the app open today". last_seen_at is one
-- overwritten timestamp, so DAU and retention could only be estimated from
-- what people did (signed up, made a loq, sent a message…). Anyone who opened
-- the app and only looked was invisible.
--
-- user_activity_days fixes that from now on: the heartbeat the client already
-- sends every minute while the app is open (useOnlinePresence →
-- /api/profile/heartbeat) upserts one row per user per day. A gap of more
-- than 30 minutes between heartbeats starts a new session, which gives
-- "app opens per user" without storing anything per open.
--
-- Days are Europe/Bratislava calendar days. No IP, no device, no page — only
-- that the user was there, when, and how many times.

CREATE TABLE IF NOT EXISTS public.user_activity_days (
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day           DATE        NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  heartbeats    INTEGER     NOT NULL DEFAULT 1,
  sessions      INTEGER     NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, day)
);

CREATE INDEX IF NOT EXISTS idx_user_activity_days_day ON public.user_activity_days(day);

-- Server-only, like security_reports (064): no policies, so anon and
-- authenticated can neither read nor write it even with RLS in play.
ALTER TABLE public.user_activity_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_activity_days FROM anon, authenticated;
GRANT ALL ON public.user_activity_days TO service_role;


-- One heartbeat. Atomic so two tabs beating at once cannot lose a count or
-- open two sessions.
CREATE OR REPLACE FUNCTION public.record_user_activity(p_user_id UUID)
RETURNS VOID
LANGUAGE sql
SET search_path = ''
AS $$
  INSERT INTO public.user_activity_days AS a (user_id, day)
  VALUES (p_user_id, (now() AT TIME ZONE 'Europe/Bratislava')::date)
  ON CONFLICT (user_id, day) DO UPDATE SET
    heartbeats   = a.heartbeats + 1,
    sessions     = a.sessions + CASE WHEN now() - a.last_seen_at > interval '30 minutes' THEN 1 ELSE 0 END,
    last_seen_at = now();
$$;

-- Functions are EXECUTE-able by PUBLIC by default — which would put this on
-- PostgREST for anyone holding the anon key.
REVOKE EXECUTE ON FUNCTION public.record_user_activity(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_user_activity(UUID) TO service_role;


-- Logins and token refreshes from the auth audit log, as (user, time).
--
-- Kept apart from admin_kpi() so that the part which may not work cannot take
-- the dashboard down with it: the project may not write the audit log to the
-- database at all, and whether the migration role may read auth.* is up to
-- Supabase. Either way this returns nothing and the KPIs fall back to the
-- other signals. SECURITY DEFINER because service_role has no grant on
-- auth.audit_log_entries; the empty search_path and the service_role-only
-- EXECUTE below are what make that safe.
CREATE OR REPLACE FUNCTION public.admin_auth_activity()
RETURNS TABLE (user_id UUID, ts TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
    SELECT (e.payload->>'actor_id')::uuid, e.created_at
      FROM auth.audit_log_entries e
     WHERE e.payload->>'actor_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
EXCEPTION
  WHEN insufficient_privilege OR undefined_table THEN
    RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_auth_activity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_auth_activity() TO service_role;


-- Everything the dashboard shows, in one round trip. Admins are excluded
-- throughout. Runs as the caller (service_role), which bypasses RLS.
--
-- "Active on day D" is the union of:
--   * user_activity_days — exact, from the day this migration ships
--   * admin_auth_activity() — logins and token refreshes, if there are any
--     (audit_log_active in the result says whether they are recent)
--   * traces in the app's own tables — signup, loq created/accepted, loqholder
--     request, loq chat, DM, vote — so history before tracking still counts
--     the people who did something
CREATE OR REPLACE FUNCTION public.admin_kpi()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
WITH
today AS (SELECT (now() AT TIME ZONE 'Europe/Bratislava')::date AS d),
users AS (
  SELECT p.id, (p.created_at AT TIME ZONE 'Europe/Bratislava')::date AS d0, p.signup_country
    FROM public.profiles p
   WHERE NOT p.is_admin
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
    FROM generate_series((SELECT min(d0) FROM users), (SELECT d FROM today), interval '1 day') AS g
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
  'launch',           (SELECT min(d0) FROM users),
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
