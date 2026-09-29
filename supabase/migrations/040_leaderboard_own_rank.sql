-- TASK-073: leaderboard redesign — pinned "Your rank" row for users who
-- fall outside the existing top-100 view. `loqholder_leaderboard` /
-- `loqee_leaderboard` (030/034) hard-LIMIT 100 and don't expose a rank
-- column, so a user outside that slice can't be found in them at all.
--
-- These new views are the same base query, unbounded, with a ROW_NUMBER()
-- rank column — read only by the new `/api/leaderboard/{loqholders,loqees}/me`
-- endpoints, one row at a time (`WHERE id = $user`). The existing limited
-- views/endpoints are untouched; the main leaderboard list still computes
-- rank as array position, unchanged.

CREATE OR REPLACE VIEW loqholder_leaderboard_all AS
SELECT
  p.id,
  COALESCE(p.display_name, split_part(p.email, '@', 1)) AS display_name,
  COUNT(l.id)::INTEGER                                    AS controlled_loqs,
  p.avatar_url,
  p.username,
  ROW_NUMBER() OVER (ORDER BY COUNT(l.id) DESC)::INTEGER  AS rank
FROM profiles p
JOIN loqs l ON l.loqholder_id = p.id
WHERE l.status = 'ended'
  AND p.status = 'active'
  AND p.leaderboard_opt_out = FALSE
GROUP BY p.id, p.display_name, p.email, p.avatar_url, p.username;

CREATE OR REPLACE VIEW loqee_leaderboard_all AS
SELECT
  p.id,
  COALESCE(p.display_name, split_part(p.email, '@', 1)) AS display_name,
  ROUND(
    MAX(EXTRACT(EPOCH FROM (l.loqed_until - l.created_at)) / 3600)::NUMERIC,
    1
  )                                                       AS longest_loq_hours,
  p.avatar_url,
  p.username,
  ROW_NUMBER() OVER (
    ORDER BY MAX(EXTRACT(EPOCH FROM (l.loqed_until - l.created_at)) / 3600) DESC
  )::INTEGER                                              AS rank
FROM profiles p
JOIN loqs l ON l.loqee_id = p.id
WHERE l.status = 'ended'
  AND l.loqed_until IS NOT NULL
  AND p.status = 'active'
  AND p.leaderboard_opt_out = FALSE
GROUP BY p.id, p.display_name, p.email, p.avatar_url, p.username;

GRANT SELECT ON loqholder_leaderboard_all TO service_role;
GRANT SELECT ON loqee_leaderboard_all     TO service_role;
