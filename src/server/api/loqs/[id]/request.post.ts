import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth, requireActiveSubscription } from '~/server/utils/auth'
import { sendPushNotification } from '~/server/utils/sendPushNotification'

export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqee') throw createError({ statusCode: 403, message: 'Only wearers can send requests' })

  await requireActiveSubscription(user.id, 'Active subscription required to request a keyholder')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const body = await readBody<{ loqholder_id: string }>(event)
  const { loqholder_id } = body ?? {}

  if (!loqholder_id || typeof loqholder_id !== 'string') {
    throw createError({ statusCode: 400, message: 'loqholder_id is required' })
  }

  const supabase = useSupabaseAdmin()

  const { data: loq } = await supabase
    .from('loqs')
    .select('id, loqee_id, status')
    .eq('id', id)
    .maybeSingle()

  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  if (loq.loqee_id !== user.id) throw createError({ statusCode: 403, message: 'Not your lock' })
  if (!['draft', 'pending'].includes(loq.status)) {
    throw createError({ statusCode: 409, message: 'Cannot send requests for a lock in this state' })
  }

  // TASK-057 — one pending request at a time. If the loqholder declines, the
  // loqee can request someone else; until then a second request is blocked.
  const { data: existingPending } = await supabase
    .from('loq_requests')
    .select('id')
    .eq('loq_id', id)
    .eq('status', 'pending')
    .maybeSingle()

  if (existingPending) {
    throw createError({
      statusCode: 409,
      statusMessage: 'REQUEST_ALREADY_PENDING',
      message: 'You already have a pending request. Cancel it before requesting another keyholder.',
    })
  }

  const { data: target } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', loqholder_id)
    .eq('role', 'loqholder')
    .eq('status', 'active')
    .maybeSingle()

  if (!target) {
    throw createError({ statusCode: 400, message: 'Not a valid keyholder' })
  }

  // Re-requesting a loqholder who previously declined reuses the same row
  // (UNIQUE(loq_id, loqholder_id)); flip it back to pending.
  const { data: request, error } = await supabase
    .from('loq_requests')
    .upsert(
      { loq_id: id, loqholder_id, status: 'pending', responded_at: null },
      { onConflict: 'loq_id,loqholder_id' },
    )
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: 'Failed to create request' })

  // Move loq from draft to pending (no-op if already pending)
  await supabase
    .from('loqs')
    // TASK-186 — when it started looking for a loqholder (draft → pending only,
    // guarded by the status filter below).
    .update({ status: 'pending', published_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'draft')

  await sendPushNotification(loqholder_id, 'New lock request', 'Someone wants you as their keyholder.', '/dashboard')

  return { request }
})
