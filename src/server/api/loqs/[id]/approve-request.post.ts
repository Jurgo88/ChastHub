import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { logAudit } from '~/server/utils/auditLog'
import { sendPushNotification } from '~/server/utils/sendPushNotification'
import { hasPremiumAccess } from '~/utils/access'

// TASK-087 — loqee approves the pending loqholder request on their own
// public loq (see request-to-join.post.ts). This is the loqee-facing
// mirror of accept.post.ts (which stays loqholder-facing, private-pairing
// only — see the guard added there).
export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqee') throw createError({ statusCode: 403, message: 'Only wearers can approve a request on their own lock' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const supabase = useSupabaseAdmin()

  const { data: loq } = await supabase
    .from('loqs')
    .select('id, loqee_id, status, is_public')
    .eq('id', id)
    .maybeSingle()

  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  if (loq.loqee_id !== user.id) throw createError({ statusCode: 403, message: 'Not your lock' })
  if (!loq.is_public) throw createError({ statusCode: 409, message: 'Not a public lock' })
  if (loq.status !== 'pending') throw createError({ statusCode: 409, message: 'Lock is not in pending state' })

  const { data: loqeeProfile } = await supabase
    .from('profiles')
    .select('subscription_status, trial_ends_at')
    .eq('id', user.id)
    .single()

  if (!hasPremiumAccess(loqeeProfile)) {
    throw createError({ statusCode: 402, message: 'Your subscription is no longer active' })
  }

  const { data: request } = await supabase
    .from('loq_requests')
    .select('id, loqholder_id')
    .eq('loq_id', id)
    .eq('status', 'pending')
    .maybeSingle()

  if (!request) throw createError({ statusCode: 404, message: 'No pending request to approve' })

  const now = new Date()

  const { data: updated, error } = await supabase
    .from('loqs')
    .update({
      status: 'active',
      loqholder_id: request.loqholder_id,
      locked: true,
      accepted_at: now.toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('*, loqholder:profiles!loqholder_id(id, display_name, avatar_url)')
    .single()

  if (error?.code === 'PGRST116' || !updated) {
    throw createError({ statusCode: 409, message: 'Lock is no longer available' })
  }
  if (error) throw createError({ statusCode: 500, message: 'Failed to approve request' })

  await supabase
    .from('loq_requests')
    .update({ status: 'accepted', responded_at: now.toISOString() })
    .eq('id', request.id)

  await logAudit(supabase, 'loq_accepted', user.id, request.loqholder_id, { loq_id: id })

  await sendPushNotification(request.loqholder_id, 'Request approved', "You're now the keyholder — it's time!", '/dashboard')

  return updated
})
