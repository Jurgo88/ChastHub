import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { logAudit } from '~/server/utils/auditLog'

export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqee') throw createError({ statusCode: 403, message: 'Only wearers can cancel their lock' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const supabase = useSupabaseAdmin()

  const { data: loq } = await supabase
    .from('loqs')
    .select('id, loqee_id, status')
    .eq('id', id)
    .maybeSingle()

  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  if (loq.loqee_id !== user.id) throw createError({ statusCode: 403, message: 'Not your lock' })
  if (['active', 'paused', 'ended', 'cancelled'].includes(loq.status)) {
    throw createError({ statusCode: 409, message: 'Cannot cancel a lock that is active, paused, or already ended' })
  }

  await supabase
    .from('loq_requests')
    .update({ status: 'cancelled', responded_at: new Date().toISOString() })
    .eq('loq_id', id)
    .eq('status', 'pending')

  const { data: updated, error } = await supabase
    .from('loqs')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: 'Failed to cancel lock' })

  await logAudit(supabase, 'loq_cancelled', user.id, user.id, { loq_id: id })

  return updated
})
