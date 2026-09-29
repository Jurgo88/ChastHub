-- TASK-185: which sources bring people who use the app and pay.
--
-- "How they found us" (068) counts signups per source. This follows each
-- source's signups further: how many ended up in an accepted loq, how many
-- ever paid, how many pay now.
--
-- Source = utm_source when the link was tagged (TASK-184 builds those), else
-- the referring host, else none. Only signups since the first recorded source
-- count, for the same reason as 068: before 067 nothing was recorded, and
-- those accounts would all read as "no source". Admins are excluded.

CREATE OR REPLACE FUNCTION public.admin_source_quality()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
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

REVOKE EXECUTE ON FUNCTION public.admin_source_quality() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_source_quality() TO service_role;
