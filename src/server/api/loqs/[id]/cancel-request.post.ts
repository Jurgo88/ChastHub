import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

// TASK-057 — let a loqee withdraw their single pending request so they can
// request a different loqholder without waiting for a decline.
export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqee') throw createError({ statusCode: 403, message: 'Only wearers can cancel requests' })

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

  const { data: request } = await supabase
    .from('loq_requests')
    .select('id')
    .eq('loq_id', id)
    .eq('status', 'pending')
    .maybeSingle()

  if (!request) throw createError({ statusCode: 404, message: 'No pending request to cancel' })

  const { error } = await supabase
    .from('loq_requests')
    .update({ status: 'cancelled', responded_at: new Date().toISOString() })
    .eq('id', request.id)

  if (error) throw createError({ statusCode: 500, message: 'Failed to cancel request' })

  return { cancelled: true }
})
