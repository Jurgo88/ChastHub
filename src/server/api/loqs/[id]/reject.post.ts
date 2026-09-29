import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { sendPushNotification } from '~/server/utils/sendPushNotification'
import { broadcastLoqUpdate } from '~/server/utils/broadcastLoq'

// TASK-102 — the accept/reject pair was asymmetric: accept.post.ts always
// notified the loqee, reject never did. The loqee was left waiting with
// no signal their request was declined unless they happened to reload.
export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqholder') throw createError({ statusCode: 403, message: 'Only keyholders can reject requests' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const supabase = useSupabaseAdmin()

  // id is the loq's own id (route param), so its loqee_id is a direct
  // lookup — no need to join through loq_requests for it.
  const { data: loq } = await supabase.from('loqs').select('loqee_id').eq('id', id).maybeSingle()

  const { data: request } = await supabase
    .from('loq_requests')
    .select('id, status')
    .eq('loq_id', id)
    .eq('loqholder_id', user.id)
    .maybeSingle()

  if (!request) throw createError({ statusCode: 404, message: 'Request not found' })
  if (request.status !== 'pending') {
    throw createError({ statusCode: 409, message: 'Request is no longer pending' })
  }

  const { data: updated, error } = await supabase
    .from('loq_requests')
    .update({ status: 'rejected', responded_at: new Date().toISOString() })
    .eq('id', request.id)
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: 'Failed to reject request' })

  if (loq?.loqee_id) {
    // pending_requests drops to 0 — merged directly by the loqee's
    // broadcast handler, no re-fetch needed for a plain count.
    await broadcastLoqUpdate(id, { loq: { id, pending_requests: 0 } })
    await sendPushNotification(loq.loqee_id, 'Request declined', 'A keyholder declined your request.', '/dashboard')
  }

  return updated
})
