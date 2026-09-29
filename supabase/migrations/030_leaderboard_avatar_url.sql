-- Add avatar_url to the leaderboard views so the leaderboard can show a
-- profile picture per row instead of a role icon badge (the role is
-- already implied by which leaderboard tab you're looking at).
--
-- avatar_url must be appended AFTER the existing columns — Postgres'
-- CREATE OR REPLACE VIEW only allows adding columns at the end of the
-- list, not inserting them between existing ones (42P16).

CREATE OR REPLACE VIEW loqholder_leaderboard AS
SELECT
  p.id,
  COALESCE(p.display_name, split_part(p.email, '@', 1)) AS display_name,
  COUNT(l.id)::INTEGER                                    AS controlled_loqs,
  p.avatar_url
FROM profiles p
JOIN loqs l ON l.loqholder_id = p.id
WHERE l.status = 'ended'
  AND p.status = 'active'
  AND p.leaderboard_opt_out = FALSE
GROUP BY p.id, p.display_name, p.email, p.avatar_url
ORDER BY controlled_loqs DESC
LIMIT 100;

CREATE OR REPLACE VIEW loqee_leaderboard AS
SELECT
  p.id,
  COALESCE(p.display_name, split_part(p.email, '@', 1)) AS display_name,
  ROUND(
    MAX(EXTRACT(EPOCH FROM (l.loqed_until - l.accepted_at)) / 3600)::NUMERIC,
    1
  )                                                       AS longest_loq_hours,
  p.avatar_url
FROM profiles p
JOIN loqs l ON l.loqee_id = p.id
WHERE l.status = 'ended'
  AND l.loqed_until IS NOT NULL
  AND l.accepted_at IS NOT NULL
  AND p.status = 'active'
  AND p.leaderboard_opt_out = FALSE
GROUP BY p.id, p.display_name, p.email, p.avatar_url
ORDER BY longest_loq_hours DESC
LIMIT 100;

GRANT SELECT ON loqholder_leaderboard TO service_role;
GRANT SELECT ON loqee_leaderboard     TO service_role;
