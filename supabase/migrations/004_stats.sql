-- ChastHub: data behind the Stats page (/stats), which replaces the leaderboard.
--
-- How a lock's time is counted (the same rule everywhere on Stats and on the
-- profile header):
--   start  = created_at. The wearer is locked from the moment the lock is
--            created (TASK-062): the clock runs while it waits for a keyholder.
--   end    = for a finished lock, whichever came first of ended_at and
--            loqed_until, so a lock ended early counts only the time it ran;
--            for a running lock, now (or paused_at while paused).
--   keyholder time runs from accepted_at to the same end.
--
-- Rankings count locks that had a keyholder, as the old leaderboard did:
-- a self-lock is honour-based and would be trivial to inflate. The one
-- exception is Locktober survivors, where self-locking is how most people
-- take part; those rows are flagged so the page can say so.
--
-- People who switched off "Show me in rankings" (leaderboard_opt_out) and
-- inactive accounts never appear in a list. They still count in the
-- anonymous totals of stats_pulse(), which name nobody.
--
-- Both functions are for the server (service role) only.

CREATE FUNCTION public.stats_locktober_start(p_now timestamptz DEFAULT now())
RETURNS timestamptz
LANGUAGE sql IMMUTABLE
SET search_path TO ''
AS $$
  -- The October in progress, or the most recent one before it.
  SELECT make_timestamptz(
    extract(year FROM p_now AT TIME ZONE 'UTC')::int
      - CASE WHEN extract(month FROM p_now AT TIME ZONE 'UTC') < 10 THEN 1 ELSE 0 END,
    10, 1, 0, 0, 0, 'UTC')
$$;

CREATE FUNCTION public.stats_board(
  p_board text,
  p_period text DEFAULT 'all',
  p_limit integer DEFAULT 50,
  p_user uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path TO ''
AS $$
DECLARE
  v_now timestamptz := now();
  v_lt_start timestamptz := public.stats_locktober_start(v_now);
  v_lt_end timestamptz := public.stats_locktober_start(v_now) + interval '1 month';
  v_from timestamptz;
  v_to timestamptz := v_now;
  v_result jsonb;
BEGIN
  IF p_period = 'month' THEN
    v_from := date_trunc('month', v_now);
  ELSIF p_period = 'locktober' THEN
    v_from := v_lt_start;
    v_to := least(v_now, v_lt_end);
  ELSE
    v_from := '-infinity';
  END IF;

  WITH spans AS (
    SELECT
      l.id,
      l.loqee_id,
      l.loqholder_id,
      l.status,
      l.ended_at,
      l.paused_at,
      l.listed_in_discover,
      l.created_at AS s_start,
      coalesce(l.accepted_at, l.created_at) AS kh_start,
      CASE
        WHEN l.status = 'ended' THEN least(coalesce(l.ended_at, l.loqed_until), l.loqed_until)
        WHEN l.status = 'paused' THEN least(coalesce(l.paused_at, v_now), l.loqed_until, v_now)
        ELSE least(l.loqed_until, v_now)
      END AS s_end,
      l.status IN ('draft', 'pending', 'active', 'paused') AS running
    FROM public.loqs l
    WHERE l.status IN ('draft', 'pending', 'active', 'paused', 'ended')
      AND l.loqed_until IS NOT NULL
  ),
  clipped AS (
    SELECT
      s.*,
      greatest(0, extract(epoch FROM (least(s.s_end, v_to) - greatest(s.s_start, v_from)))) / 3600.0 AS w_hours,
      greatest(0, extract(epoch FROM (least(s.s_end, v_to) - greatest(s.kh_start, v_from)))) / 3600.0 AS kh_hours
    FROM spans s
  ),
  scores AS (
    -- Wearers
    SELECT c.loqee_id AS uid, max(c.w_hours) AS v, false AS self_lock, NULL::timestamptz AS since
      FROM clipped c
     WHERE p_board = 'wearer_longest' AND c.loqholder_id IS NOT NULL AND c.w_hours > 0
     GROUP BY c.loqee_id
    UNION ALL
    SELECT c.loqee_id, sum(c.w_hours), false, NULL
      FROM clipped c
     WHERE p_board = 'wearer_total' AND c.loqholder_id IS NOT NULL AND c.w_hours > 0
     GROUP BY c.loqee_id
    UNION ALL
    SELECT c.loqee_id, count(*), false, NULL
      FROM clipped c
     WHERE p_board = 'wearer_completed' AND c.loqholder_id IS NOT NULL AND c.status = 'ended'
       AND c.ended_at >= v_from AND c.ended_at <= v_to
     GROUP BY c.loqee_id
    UNION ALL
    SELECT c.loqee_id, max(extract(epoch FROM (c.s_end - c.s_start)) / 3600.0), false, min(c.s_start)
      FROM clipped c
     WHERE p_board = 'wearer_running' AND c.running AND c.loqholder_id IS NOT NULL
     GROUP BY c.loqee_id
    UNION ALL
    -- Keyholders
    SELECT c.loqholder_id, count(*), false, NULL
      FROM clipped c
     WHERE p_board = 'keyholder_locks' AND c.loqholder_id IS NOT NULL AND c.kh_hours > 0
     GROUP BY c.loqholder_id
    UNION ALL
    SELECT c.loqholder_id, sum(c.kh_hours), false, NULL
      FROM clipped c
     WHERE p_board = 'keyholder_hours' AND c.loqholder_id IS NOT NULL AND c.kh_hours > 0
     GROUP BY c.loqholder_id
    UNION ALL
    SELECT c.loqholder_id, count(DISTINCT c.loqee_id), false, NULL
      FROM clipped c
     WHERE p_board = 'keyholder_wearers' AND c.loqholder_id IS NOT NULL AND c.kh_hours > 0
     GROUP BY c.loqholder_id
    UNION ALL
    SELECT c.loqholder_id, count(*), false, NULL
      FROM clipped c
     WHERE p_board = 'keyholder_holding' AND c.running AND c.loqholder_id IS NOT NULL
     GROUP BY c.loqholder_id
    UNION ALL
    -- Crowd favorites: time visitors added to locks listed in Key Drop.
    SELECT l.loqee_id, sum(vi.hours_added), false, NULL
      FROM public.loq_visitor_interactions vi
      JOIN public.loqs l ON l.id = vi.loq_id
     WHERE p_board = 'crowd' AND vi.direction = 'add' AND l.listed_in_discover
       AND vi.created_at >= v_from AND vi.created_at <= v_to
     GROUP BY l.loqee_id
    UNION ALL
    -- Locktober survivors: locked by the end of Oct 1 and never unlocked
    -- since. A pause (hygiene, a check-up) is fine; a pause running longer
    -- than 24 hours means the lock is off, and drops them from the list.
    SELECT c.loqee_id,
           max(extract(epoch FROM (v_now - greatest(c.s_start, v_lt_start))) / 3600.0),
           bool_and(c.loqholder_id IS NULL),
           min(c.s_start)
      FROM clipped c
     WHERE p_board = 'locktober_survivors'
       AND v_now >= v_lt_start AND v_now < v_lt_end
       AND c.running
       AND c.s_start < v_lt_start + interval '1 day'
       AND (c.status <> 'paused' OR c.paused_at > v_now - interval '24 hours')
     GROUP BY c.loqee_id
  ),
  ranked AS (
    SELECT
      sc.uid, sc.v, sc.self_lock, sc.since,
      p.display_name, p.username, p.avatar_url,
      row_number() OVER (ORDER BY sc.v DESC, sc.since NULLS LAST, p.created_at) AS rank,
      count(*) OVER () AS total
    FROM scores sc
    JOIN public.profiles p ON p.id = sc.uid
    WHERE sc.v > 0 AND p.status = 'active' AND NOT p.leaderboard_opt_out
  )
  SELECT jsonb_build_object(
    'board', p_board,
    'period', p_period,
    'total', coalesce((SELECT max(r.total) FROM ranked r), 0),
    'rows', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'rank', r.rank,
               'id', r.uid,
               'display_name', coalesce(r.display_name, 'ChastHub user'),
               'username', r.username,
               'avatar_url', r.avatar_url,
               'value', round(r.v::numeric, 1),
               'self_lock', r.self_lock,
               'since', r.since
             ) ORDER BY r.rank)
        FROM ranked r
       WHERE r.rank <= p_limit
    ), '[]'::jsonb),
    'me', (
      SELECT jsonb_build_object(
               'rank', r.rank,
               'id', r.uid,
               'display_name', coalesce(r.display_name, 'ChastHub user'),
               'username', r.username,
               'avatar_url', r.avatar_url,
               'value', round(r.v::numeric, 1),
               'self_lock', r.self_lock,
               'since', r.since,
               'next_value', (SELECT round(r2.v::numeric, 1) FROM ranked r2 WHERE r2.rank = r.rank - 1),
               'below', (SELECT count(*) FROM ranked r3 WHERE r3.v < r.v)
             )
        FROM ranked r
       WHERE p_user IS NOT NULL AND r.uid = p_user
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE FUNCTION public.stats_pulse()
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path TO ''
AS $$
WITH
now_ AS (SELECT now() AS t, public.stats_locktober_start(now()) AS lt),
spans AS (
  SELECT
    l.loqee_id,
    l.loqholder_id,
    l.status,
    l.ended_at,
    l.paused_at,
    l.created_at AS s_start,
    CASE
      WHEN l.status = 'ended' THEN least(coalesce(l.ended_at, l.loqed_until), l.loqed_until)
      WHEN l.status = 'paused' THEN least(coalesce(l.paused_at, n.t), l.loqed_until, n.t)
      ELSE least(l.loqed_until, n.t)
    END AS s_end,
    l.status IN ('draft', 'pending', 'active', 'paused') AS running
  FROM public.loqs l, now_ n
  WHERE l.status IN ('draft', 'pending', 'active', 'paused', 'ended')
    AND l.loqed_until IS NOT NULL
)
SELECT jsonb_build_object(
  'locked_now', (SELECT count(*) FROM spans s WHERE s.running),
  'hours_this_month', (
    SELECT round(coalesce(sum(greatest(0, extract(epoch FROM (least(s.s_end, n.t) - greatest(s.s_start, date_trunc('month', n.t)))))), 0)::numeric / 3600, 0)
      FROM spans s, now_ n
  ),
  'done_this_week', (SELECT count(*) FROM spans s, now_ n WHERE s.status = 'ended' AND s.ended_at > n.t - interval '7 days'),
  'keyholders_active', (SELECT count(DISTINCT s.loqholder_id) FROM spans s WHERE s.running AND s.loqholder_id IS NOT NULL),
  'keydrop_waiting', (
    SELECT count(*) FROM public.loqs l
     WHERE l.listed_in_discover AND l.public_link_id IS NOT NULL AND l.loqholder_id IS NULL
       AND l.status IN ('pending', 'active', 'paused')
  ),
  'locktober', (
    SELECT jsonb_build_object(
      'year', extract(year FROM n.lt AT TIME ZONE 'UTC')::int,
      'active', n.t >= n.lt AND n.t < n.lt + interval '1 month',
      'day', CASE WHEN n.t >= n.lt AND n.t < n.lt + interval '1 month'
                  THEN extract(day FROM n.t AT TIME ZONE 'UTC')::int END,
      'starters', (SELECT count(DISTINCT s.loqee_id) FROM spans s
                    WHERE s.s_start < n.lt + interval '1 day' AND s.s_end >= n.lt),
      'survivors', (SELECT count(DISTINCT s.loqee_id) FROM spans s
                     WHERE n.t < n.lt + interval '1 month' AND n.t >= n.lt
                       AND s.running AND s.s_start < n.lt + interval '1 day'
                       AND (s.status <> 'paused' OR s.paused_at > n.t - interval '24 hours')),
      'joined', (SELECT count(DISTINCT s.loqee_id) FROM spans s
                  WHERE s.s_start < least(n.t, n.lt + interval '1 month') AND s.s_end >= n.lt)
    )
    FROM now_ n
  )
)
$$;

REVOKE ALL ON FUNCTION public.stats_locktober_start(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stats_board(text, text, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stats_pulse() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stats_locktober_start(timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.stats_board(text, text, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.stats_pulse() TO service_role;
