import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { MAX_CHECKIN_PENALTY_MINUTES, localParts } from '~/server/utils/checkin'

// POST /api/loqs/<id>/checkin-settings { required, penalty_minutes }: the
// keyholder makes the daily check-in compulsory, with a penalty for a missed day.
export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqholder') throw createError({ statusCode: 403, message: 'Only keyholders can change this' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const body = await readBody<{ required?: unknown; penalty_minutes?: unknown }>(event)
  if (typeof body?.required !== 'boolean') throw createError({ statusCode: 400, message: 'required must be true or false' })
  const penalty = body.penalty_minutes === undefined ? 0 : body.penalty_minutes
  if (typeof penalty !== 'number' || !Number.isInteger(penalty) || penalty < 0 || penalty > MAX_CHECKIN_PENALTY_MINUTES) {
    throw createError({ statusCode: 400, message: `penalty_minutes must be a whole number from 0 to ${MAX_CHECKIN_PENALTY_MINUTES}` })
  }

  const supabase = useSupabaseAdmin()
  const { data: loq } = await supabase
    .from('loqs')
    .select('id, loqholder_id, status, checkin_tz')
    .eq('id', id)
    .maybeSingle()
  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  if (loq.loqholder_id !== user.id) throw createError({ statusCode: 403, message: 'Not your lock' })
  if (!['active', 'paused'].includes(loq.status)) throw createError({ statusCode: 409, message: 'Lock is not running' })

  // A rule that starts today only bites from tomorrow's missed day onward, so
  // today counts as already settled.
  const update: Record<string, unknown> = { checkin_required: body.required, checkin_penalty_minutes: body.required ? penalty : 0 }
  if (body.required) update.checkin_penalty_through = localParts(Date.now(), loq.checkin_tz ?? 'UTC').date

  const { error } = await supabase.from('loqs').update(update).eq('id', id)
  if (error) throw createError({ statusCode: 500, message: 'Failed to save settings' })

  return { required: body.required, penalty_minutes: update.checkin_penalty_minutes }
})
