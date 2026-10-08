import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { MAX_PENALTY_MINUTES, MAX_REQUESTS_PER_DAY, DUE_CHOICES_MINUTES } from '~/server/utils/verification'
import { createVerification, loadVerificationLock } from '~/server/utils/verificationDb'

// POST /api/loqs/<id>/verifications { due_minutes, penalty_minutes }: the
// keyholder asks for a verification photo now. On a self-lock the wearer asks
// themselves.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const body = await readBody<{ due_minutes?: unknown; penalty_minutes?: unknown }>(event)
  const due = body?.due_minutes
  const penalty = body?.penalty_minutes === undefined ? 0 : body.penalty_minutes
  if (typeof due !== 'number' || !(DUE_CHOICES_MINUTES as readonly number[]).includes(due)) {
    throw createError({ statusCode: 400, message: `due_minutes must be one of ${DUE_CHOICES_MINUTES.join(', ')}` })
  }
  if (typeof penalty !== 'number' || !Number.isInteger(penalty) || penalty < 0 || penalty > MAX_PENALTY_MINUTES) {
    throw createError({ statusCode: 400, message: `penalty_minutes must be a whole number from 0 to ${MAX_PENALTY_MINUTES}` })
  }

  if (!await checkRateLimit(`verification-request:${user.id}`, 10, 60_000)) {
    throw createError({ statusCode: 429, message: 'Too many attempts. Slow down.' })
  }

  const supabase = useSupabaseAdmin()
  const { loq, isKeyholder, isSelfLock, isWearer } = await loadVerificationLock(supabase, id, user.id)
  if (!isKeyholder && !(isSelfLock && isWearer)) {
    throw createError({ statusCode: 403, message: 'Only the keyholder can request a verification' })
  }
  if (loq.status !== 'active') throw createError({ statusCode: 409, message: 'Lock is not running' })

  const { data: open } = await supabase
    .from('loq_verifications')
    .select('id')
    .eq('loq_id', id)
    .in('status', ['pending', 'submitted'])
    .limit(1)
  if (open?.length) throw createError({ statusCode: 409, message: 'There is already an open verification' })

  const since = new Date(Date.now() - 24 * 3_600_000).toISOString()
  const { count } = await supabase
    .from('loq_verifications')
    .select('id', { count: 'exact', head: true })
    .eq('loq_id', id)
    .not('requested_by', 'is', null)
    .gte('created_at', since)
  if ((count ?? 0) >= MAX_REQUESTS_PER_DAY) {
    throw createError({ statusCode: 429, message: `At most ${MAX_REQUESTS_PER_DAY} requests per 24 hours` })
  }

  const created = await createVerification(supabase, loq, { requestedBy: user.id, dueMinutes: due, penaltyMinutes: penalty })
  if (!created) throw createError({ statusCode: 500, message: 'Failed to create the request' })
  return { id: created.id, code: created.code, due_at: created.due_at }
})
