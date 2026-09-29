-- TASK-062: loq clock now starts at creation, not at loqholder acceptance
-- (loqed_until is set in POST /api/loqs and never recomputed on accept).
--
-- loqee_leaderboard's longest_loq_hours used `loqed_until - accepted_at`,
-- which used to equal the full configured duration back when loqed_until
-- was only set at acceptance. That's no longer true — accepted_at now
-- lands partway through an already-running clock, so `loqed_until -
-- accepted_at` would read as "remaining time left when accepted" instead
-- of the loq's actual total duration.
--
-- `loqed_until - created_at` is the correct span now: the clock always
-- runs from creation to loqed_until (including any loqholder/visitor time
-- adjustments applied along the way), regardless of when/whether a
-- loqholder ever accepted.

CREATE OR REPLACE VIEW loqee_leaderboard AS
SELECT
  p.id,
  COALESCE(p.display_name, split_part(p.email, '@', 1)) AS display_name,
  ROUND(
    MAX(EXTRACT(EPOCH FROM (l.loqed_until - l.created_at)) / 3600)::NUMERIC,
    1
  )                                                       AS longest_loq_hours,
  p.avatar_url
FROM profiles p
JOIN loqs l ON l.loqee_id = p.id
WHERE l.status = 'ended'
  AND l.loqed_until IS NOT NULL
  AND p.status = 'active'
  AND p.leaderboard_opt_out = FALSE
GROUP BY p.id, p.display_name, p.email, p.avatar_url
ORDER BY longest_loq_hours DESC
LIMIT 100;

GRANT SELECT ON loqee_leaderboard TO service_role;
