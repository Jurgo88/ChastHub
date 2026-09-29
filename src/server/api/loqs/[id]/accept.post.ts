import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { logAudit } from '~/server/utils/auditLog'
import { sendPushNotification } from '~/server/utils/sendPushNotification'
import { broadcastLoqUpdate } from '~/server/utils/broadcastLoq'
import { hasPremiumAccess } from '~/utils/access'

export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqholder') throw createError({ statusCode: 403, message: 'Only keyholders can accept locks' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const supabase = useSupabaseAdmin()

  const { data: loq } = await supabase
    .from('loqs')
    .select('id, loqee_id, loqholder_id, status, is_public')
    .eq('id', id)
    .maybeSingle()

  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  if (loq.status !== 'pending') {
    throw createError({ statusCode: 409, message: 'Lock is not in pending state' })
  }

  const { data: loqeeProfile } = await supabase
    .from('profiles')
    .select('subscription_status, trial_ends_at')
    .eq('id', loq.loqee_id)
    .single()

  if (!hasPremiumAccess(loqeeProfile)) {
    await supabase.from('loqs').update({ status: 'cancelled' }).eq('id', id)
    throw createError({ statusCode: 402, message: 'Wearer subscription is no longer active' })
  }

  // TASK-087 — public loqs no longer accept directly: any loqholder
  // instantly claiming a public loq with zero review was the exact
  // fairness problem the client flagged. Public loqs now go through
  // request-to-join.post.ts + the loqee's own approve-request.post.ts.
  if (loq.is_public) {
    throw createError({ statusCode: 409, message: 'Public locks are joined by request — use "Request to join" instead' })
  }

  const { data: request } = await supabase
    .from('loq_requests')
    .select('id')
    .eq('loq_id', id)
    .eq('loqholder_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (!request) throw createError({ statusCode: 403, message: 'You have no pending request for this lock' })

  const now = new Date()

  // loqed_until was already set at creation (TASK-062) — the clock has been
  // running since then. Accepting only hands control to this loqholder, it
  // does not restart or recompute the timer.
  // Atomic update: extra .eq('status', 'pending') prevents double-accept race
  const { data: updated, error } = await supabase
    .from('loqs')
    .update({
      status: 'active',
      loqholder_id: user.id,
      locked: true,
      accepted_at: now.toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('*, loqee:profiles!loqee_id(id, display_name, avatar_url)')
    .single()

  if (error?.code === 'PGRST116' || !updated) {
    throw createError({ statusCode: 409, message: 'Lock was already accepted by another keyholder' })
  }
  if (error) throw createError({ statusCode: 500, message: 'Failed to accept lock' })

  // Mark this loqholder's request as accepted
  await supabase
    .from('loq_requests')
    .update({ status: 'accepted', responded_at: now.toISOString() })
    .eq('loq_id', id)
    .eq('loqholder_id', user.id)
    .eq('status', 'pending')

  // Safety cleanup: defensive no-op in practice (TASK-057's unique index
  // already guarantees at most one pending row exists), kept in case that
  // constraint is ever relaxed.
  await supabase
    .from('loq_requests')
    .update({ status: 'auto_rejected', responded_at: now.toISOString() })
    .eq('loq_id', id)
    .eq('status', 'pending')

  await logAudit(supabase, 'loq_accepted', user.id, loq.loqee_id, { loq_id: id })

  // TASK-102 — the loqee's dashboard was never told their request got
  // accepted; it only found out on a manual reload, same gap TASK-099
  // fixed for the reverse (public-queue) direction.
  await broadcastLoqUpdate(id, { loq: { id, status: 'active' } })

  await sendPushNotification(loq.loqee_id, 'Lock accepted', 'Your lock request was accepted. It\'s time!', '/dashboard')

  return updated
})
