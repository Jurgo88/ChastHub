-- Opt-out flag (default: visible on leaderboard)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS leaderboard_opt_out BOOLEAN NOT NULL DEFAULT FALSE;

-- Loqholder leaderboard view
-- controlled_loqs = number of ended relationships as loqholder
CREATE OR REPLACE VIEW loqholder_leaderboard AS
SELECT
  p.id,
  COALESCE(p.display_name, split_part(p.email, '@', 1)) AS display_name,
  COUNT(r.id)::INTEGER                                    AS controlled_loqs
FROM profiles p
JOIN relationships r ON r.keyholder_id = p.id
WHERE r.status = 'ended'
  AND p.status = 'active'
  AND p.leaderboard_opt_out = FALSE
GROUP BY p.id, p.display_name, p.email
ORDER BY controlled_loqs DESC
LIMIT 100;

-- Loqee leaderboard view
-- longest_loq_hours = longest single non-demo lock by locked_until - created_at
CREATE OR REPLACE VIEW loqee_leaderboard AS
SELECT
  p.id,
  COALESCE(p.display_name, split_part(p.email, '@', 1)) AS display_name,
  ROUND(
    MAX(EXTRACT(EPOCH FROM (l.locked_until - l.created_at)) / 3600)::NUMERIC,
    1
  )                                                       AS longest_loq_hours
FROM profiles p
JOIN relationships r ON r.lockee_id = p.id
JOIN locks l ON l.relationship_id = r.id
WHERE l.locked = FALSE
  AND l.is_demo = FALSE
  AND l.locked_until > l.created_at
  AND p.status = 'active'
  AND p.leaderboard_opt_out = FALSE
GROUP BY p.id, p.display_name, p.email
ORDER BY longest_loq_hours DESC
LIMIT 100;

-- Grant read access to service_role (used by server API)
GRANT SELECT ON loqholder_leaderboard TO service_role;
GRANT SELECT ON loqee_leaderboard     TO service_role;
