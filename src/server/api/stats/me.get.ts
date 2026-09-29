import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { ROLE_BOARDS, STATS_PERIODS, type StatsPeriod } from '~/server/utils/statsBoards'

// "Your stats": your place on every board for your role in one call.
// Empty while you are hidden from rankings, since then you have no place.
export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  const period = String(getQuery(event).period ?? 'all') as StatsPeriod
  if (!STATS_PERIODS.includes(period)) throw createError({ statusCode: 400, message: 'Unknown period' })

  const supabase = useSupabaseAdmin()
  const { data: profile } = await supabase.from('profiles').select('leaderboard_opt_out').eq('id', user.id).single()
  const boards = ROLE_BOARDS[role] ?? []

  if (profile?.leaderboard_opt_out) return { hidden: true, role, boards: {} }

  const results = await Promise.all(boards.map(async (board) => {
    // Survivors only exist during Locktober; the other boards follow the
    // period the page is showing.
    const p = board === 'locktober_survivors' ? 'locktober' : period
    const { data } = await supabase.rpc('stats_board', { p_board: board, p_period: p, p_limit: 0, p_user: user.id })
    const res = data as { total: number; me: unknown } | null
    return [board, { total: res?.total ?? 0, me: res?.me ?? null }] as const
  }))

  return { hidden: false, role, boards: Object.fromEntries(results) }
})
