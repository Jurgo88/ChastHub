-- TASK-165: "How they found us" on the super-admin KPI panel.
--
-- Reads the signup_referrer / signup_utm_* columns that TASK-164 (067)
-- records. Kept apart from admin_kpi() (065) so that function did not have to
-- be rewritten, and so the panel keeps working when this one is missing.
--
-- Only signups since the first recorded source count. Before 067 nothing was
-- recorded, and counting those accounts as "no source" would drown the real
-- answer. Admins are excluded, as everywhere in the KPIs.

CREATE OR REPLACE FUNCTION public.admin_signup_sources()
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

REVOKE EXECUTE ON FUNCTION public.admin_signup_sources() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_signup_sources() TO service_role;
