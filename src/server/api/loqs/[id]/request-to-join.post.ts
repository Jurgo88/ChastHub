import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { sendPushNotification } from '~/server/utils/sendPushNotification'
import { broadcastLoqUpdate } from '~/server/utils/broadcastLoq'

// TASK-087 — a loqholder requesting to take over a *public* loq (the
// Discover listing). Mirrors request.post.ts's loqee-requests-a-
// loqholder flow in the other direction: here the loqee has final say
// (approve-request.post.ts / reject-request.post.ts), closing the old
// race where any loqholder could just accept.post.ts a public loq
// instantly with no review at all.
export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqholder') throw createError({ statusCode: 403, message: 'Only keyholders can request to join a lock' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const supabase = useSupabaseAdmin()

  const { data: loq } = await supabase
    .from('loqs')
    .select('id, loqee_id, is_public, status')
    .eq('id', id)
    .maybeSingle()

  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  if (!loq.is_public) throw createError({ statusCode: 403, message: 'This lock is not public' })
  if (!['draft', 'pending'].includes(loq.status)) {
    throw createError({ statusCode: 409, message: 'Cannot request a lock in this state' })
  }

  // TASK-057's one-pending-request-per-loq index applies here too — only
  // one loqholder can be "in the queue" for this loq at a time.
  const { data: existingPending } = await supabase
    .from('loq_requests')
    .select('id, loqholder_id')
    .eq('loq_id', id)
    .eq('status', 'pending')
    .maybeSingle()

  if (existingPending) {
    throw createError({
      statusCode: 409,
      message: existingPending.loqholder_id === user.id
        ? 'You already have a pending request for this lock'
        : 'Someone else already has a pending request for this lock',
    })
  }

  const { data: request, error } = await supabase
    .from('loq_requests')
    .upsert(
      { loq_id: id, loqholder_id: user.id, status: 'pending', responded_at: null },
      { onConflict: 'loq_id,loqholder_id' },
    )
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: 'Failed to send request' })

  // TASK-099 — the loqee's dashboard was never told a request came in; it
  // only picked one up on a manual reload. `incoming_request: true` is a
  // signal, not the actual data (the loqholder's profile needs a join
  // current.get.ts already does) — the client refetches on seeing it,
  // same pattern already used for the 'ended' broadcast.
  await broadcastLoqUpdate(loq.id, { loq: { id: loq.id, incoming_request: true } })

  await sendPushNotification(loq.loqee_id, 'Keyholder wants to join', 'A keyholder requested to take control of your public lock.', '/dashboard')

  return { request }
})
