-- TASK-058: self-loqs (loqholder_id IS NULL) opt out of the loqee "longest
-- loq" leaderboard — nothing stops a loqee from self-loqing for 400 days
-- with zero external oversight, which would trivially dominate rankings
-- that are meant to reflect a loqholder-supervised session. Loqholder
-- leaderboard views are unaffected (they JOIN on loqholder_id, which
-- already excludes self-loqs structurally).

CREATE OR REPLACE VIEW loqee_leaderboard AS
SELECT
  p.id,
  COALESCE(p.display_name, split_part(p.email, '@', 1)) AS display_name,
  ROUND(
    MAX(EXTRACT(EPOCH FROM (l.loqed_until - l.created_at)) / 3600)::NUMERIC,
    1
  )                                                       AS longest_loq_hours,
  p.avatar_url,
  p.username
FROM profiles p
JOIN loqs l ON l.loqee_id = p.id
WHERE l.status = 'ended'
  AND l.loqed_until IS NOT NULL
  AND l.loqholder_id IS NOT NULL
  AND p.status = 'active'
  AND p.leaderboard_opt_out = FALSE
GROUP BY p.id, p.display_name, p.email, p.avatar_url, p.username
ORDER BY longest_loq_hours DESC
LIMIT 100;

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
  AND l.loqholder_id IS NOT NULL
  AND p.status = 'active'
  AND p.leaderboard_opt_out = FALSE
GROUP BY p.id, p.display_name, p.email, p.avatar_url, p.username;

GRANT SELECT ON loqee_leaderboard     TO service_role;
GRANT SELECT ON loqee_leaderboard_all TO service_role;
