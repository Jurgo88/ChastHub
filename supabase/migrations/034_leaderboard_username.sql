-- TASK-066: leaderboard rows link to the new public profile page
-- (/user/{username}), so both views need username. Appended after the
-- existing columns per the append-only rule noted in 030 (CREATE OR
-- REPLACE VIEW can't insert a column between existing ones, 42P16).

CREATE OR REPLACE VIEW loqholder_leaderboard AS
SELECT
  p.id,
  COALESCE(p.display_name, split_part(p.email, '@', 1)) AS display_name,
  COUNT(l.id)::INTEGER                                    AS controlled_loqs,
  p.avatar_url,
  p.username
FROM profiles p
JOIN loqs l ON l.loqholder_id = p.id
WHERE l.status = 'ended'
  AND p.status = 'active'
  AND p.leaderboard_opt_out = FALSE
GROUP BY p.id, p.display_name, p.email, p.avatar_url, p.username
ORDER BY controlled_loqs DESC
LIMIT 100;

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
  AND p.status = 'active'
  AND p.leaderboard_opt_out = FALSE
GROUP BY p.id, p.display_name, p.email, p.avatar_url, p.username
ORDER BY longest_loq_hours DESC
LIMIT 100;

GRANT SELECT ON loqholder_leaderboard TO service_role;
GRANT SELECT ON loqee_leaderboard     TO service_role;
