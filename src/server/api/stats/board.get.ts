import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { STATS_BOARDS, STATS_PERIODS, cachePublicStats, type StatsBoardKey, type StatsPeriod } from '~/server/utils/statsBoards'

// One ranking. Public like the old leaderboard; people who opted out of
// rankings never appear (the SQL filters them). Your own row comes from
// /api/stats/me, which needs a session.
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const board = String(q.board ?? '') as StatsBoardKey
  const period = String(q.period ?? 'all') as StatsPeriod
  const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 100)

  if (!STATS_BOARDS.includes(board)) throw createError({ statusCode: 400, message: 'Unknown board' })
  if (!STATS_PERIODS.includes(period)) throw createError({ statusCode: 400, message: 'Unknown period' })

  const { data, error } = await useSupabaseAdmin().rpc('stats_board', {
    p_board: board, p_period: period, p_limit: limit, p_user: null,
  })
  if (error) {
    console.error('[stats/board]', error.message)
    throw createError({ statusCode: 500, message: 'Could not load this ranking' })
  }
  cachePublicStats(event)
  return data
})
