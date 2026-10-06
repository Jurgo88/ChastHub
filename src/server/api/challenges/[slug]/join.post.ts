import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { CHALLENGE_COLUMNS, LOCK_COLUMNS, type ChallengeRow, type LockRow } from '~/server/utils/challengeData'
import { joinProblem } from '~/utils/challenges'

// POST /api/challenges/<slug>/join: take part with your current lock.
export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqee') throw createError({ statusCode: 403, message: 'Only wearers can join a challenge' })

  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, message: 'Challenge required' })

  const supabase = useSupabaseAdmin()
  const { data: challenge } = await supabase.from('challenges').select(CHALLENGE_COLUMNS).eq('slug', slug).maybeSingle<ChallengeRow>()
  if (!challenge) throw createError({ statusCode: 404, message: 'Challenge not found' })

  const { data: lock } = await supabase
    .from('loqs')
    .select(LOCK_COLUMNS)
    .eq('loqee_id', user.id)
    .in('status', ['draft', 'pending', 'active', 'paused'])
    .maybeSingle<LockRow>()

  const problem = joinProblem(challenge, lock ?? null, Date.now())
  if (problem) throw createError({ statusCode: 409, message: problem })

  const { error } = await supabase
    .from('challenge_entries')
    .insert({ challenge_id: challenge.id, user_id: user.id, loq_id: lock!.id })
  if (error) {
    if (error.code === '23505') throw createError({ statusCode: 409, message: 'You are already in this challenge' })
    throw createError({ statusCode: 500, message: 'Could not join the challenge' })
  }

  return { joined: true }
})
