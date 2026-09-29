import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { logAudit } from '~/server/utils/auditLog'
import { MAX_DURATION_MINUTES } from '~/server/utils/loqValidation'

export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqholder') throw createError({ statusCode: 403, message: 'Only keyholders can adjust time' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const body = await readBody<{ delta_minutes: number }>(event)
  const { delta_minutes } = body ?? {}

  if (typeof delta_minutes !== 'number' || delta_minutes === 0) {
    throw createError({ statusCode: 400, message: 'delta_minutes must be a non-zero number' })
  }

  const supabase = useSupabaseAdmin()

  const { data: loq } = await supabase
    .from('loqs')
    .select('id, loqee_id, loqholder_id, status, loqed_until')
    .eq('id', id)
    .maybeSingle()

  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  if (loq.loqholder_id !== user.id) throw createError({ statusCode: 403, message: 'Not your lock' })
  if (loq.status !== 'active') throw createError({ statusCode: 409, message: 'Lock is not active' })
  if (!loq.loqed_until) throw createError({ statusCode: 409, message: 'Lock has no timer set' })

  const newUntil = new Date(new Date(loq.loqed_until).getTime() + delta_minutes * 60_000)

  if (newUntil < new Date(Date.now() + 60_000)) {
    throw createError({ statusCode: 400, message: 'Cannot reduce time below 1 minute remaining' })
  }
  if (newUntil > new Date(Date.now() + MAX_DURATION_MINUTES * 60_000)) {
    throw createError({ statusCode: 400, message: `Cannot extend beyond ${Math.floor(MAX_DURATION_MINUTES / 1440)} days total` })
  }

  const { data: updated, error } = await supabase
    .from('loqs')
    .update({ loqed_until: newUntil.toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: 'Failed to update time' })

  const action = delta_minutes > 0 ? 'loq_time_added' : 'loq_time_removed'
  await logAudit(supabase, action, user.id, loq.loqee_id, { loq_id: id, delta_minutes })

  return updated
})
