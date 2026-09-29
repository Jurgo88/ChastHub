import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { sendPushNotification } from '~/server/utils/sendPushNotification'

// TASK-087 — loqee declines the pending loqholder request on their own
// public loq. Frees the pending slot so another loqholder can request it.
export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqee') throw createError({ statusCode: 403, message: 'Only wearers can reject a request on their own lock' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const supabase = useSupabaseAdmin()

  const { data: loq } = await supabase
    .from('loqs')
    .select('id, loqee_id')
    .eq('id', id)
    .maybeSingle()

  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  if (loq.loqee_id !== user.id) throw createError({ statusCode: 403, message: 'Not your lock' })

  const { data: request } = await supabase
    .from('loq_requests')
    .select('id, status, loqholder_id')
    .eq('loq_id', id)
    .eq('status', 'pending')
    .maybeSingle()

  if (!request) throw createError({ statusCode: 404, message: 'No pending request to reject' })

  const { data: updated, error } = await supabase
    .from('loq_requests')
    .update({ status: 'rejected', responded_at: new Date().toISOString() })
    .eq('id', request.id)
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: 'Failed to reject request' })

  // TASK-102 — the requesting loqholder was never told their request-to-join
  // was declined. Their dashboard's own realtime subscription (postgres_changes
  // on loq_requests WHERE loqholder_id = them) already picks up this UPDATE
  // and re-fetches their request list — this only adds the push.
  await sendPushNotification(request.loqholder_id, 'Request declined', 'The wearer declined your request to join their lock.', '/keydrop')

  return updated
})
