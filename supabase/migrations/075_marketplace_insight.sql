-- TASK-186: the two sides of the marketplace — how long loqs wait for a
-- loqholder, how many wait now, and whether there are enough loqholders.
--
-- loqs had no record of when they went looking for a loqholder: created_at is
-- when the draft was made, so "created → accepted" counts time spent as a
-- draft. published_at is set when a loq first leaves draft for pending
-- (api/loqs/[id]/publish.post.ts and request.post.ts). Older loqs fall back to
-- created_at, and the result says from when the numbers are exact.
--
-- Self-loqs (no loqholder, active from the start) never look for anyone and
-- are never counted.

ALTER TABLE public.loqs ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.admin_marketplace()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
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

REVOKE EXECUTE ON FUNCTION public.admin_marketplace() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_marketplace() TO service_role;
