import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { buildBoard, CHALLENGE_COLUMNS, describeChallenge, LOCK_COLUMNS, type ChallengeRow, type LockRow } from '~/server/utils/challengeData'
import { joinProblem } from '~/utils/challenges'

// GET /api/challenges/<slug>: the challenge, its board (people who hide from
// rankings are left out), your own standing and, if you are not in yet,
// whether you could join and why not.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, message: 'Challenge required' })

  const supabase = useSupabaseAdmin()
  const { data: challenge } = await supabase.from('challenges').select(CHALLENGE_COLUMNS).eq('slug', slug).maybeSingle<ChallengeRow>()
  if (!challenge || !challenge.active) throw createError({ statusCode: 404, message: 'Challenge not found' })

  const now = Date.now()
  const board = await buildBoard(supabase, challenge, user.id, now)

  let joinBlocked: string | null = null
  if (!board.me) {
    const { data: lock } = await supabase
      .from('loqs')
      .select(LOCK_COLUMNS)
      .eq('loqee_id', user.id)
      .in('status', ['draft', 'pending', 'active', 'paused'])
      .maybeSingle<LockRow>()
    joinBlocked = joinProblem(challenge, lock ?? null, now)
  }

  return { challenge: describeChallenge(challenge, now), ...board, join_blocked: joinBlocked }
})
