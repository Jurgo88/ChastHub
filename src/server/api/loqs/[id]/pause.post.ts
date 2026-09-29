import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { logAudit } from '~/server/utils/auditLog'

export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqholder' && role !== 'loqee') {
    throw createError({ statusCode: 403, message: 'Only keyholders or wearers can pause locks' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const supabase = useSupabaseAdmin()

  const { data: loq } = await supabase
    .from('loqs')
    .select('id, loqee_id, loqholder_id, status, loqed_until, paused_at')
    .eq('id', id)
    .maybeSingle()

  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })

  // Loqholder controls a paired loq; a self-loq (no loqholder) is
  // self-service by its owner (TASK-058 — client confirmed the loqee can
  // pause/end their own self-loq).
  const isOwningLoqholder = role === 'loqholder' && loq.loqholder_id === user.id
  const isSelfLoqOwner = role === 'loqee' && loq.loqee_id === user.id && loq.loqholder_id === null
  if (!isOwningLoqholder && !isSelfLoqOwner) throw createError({ statusCode: 403, message: 'Not your lock' })

  if (!['active', 'paused'].includes(loq.status)) {
    throw createError({ statusCode: 409, message: 'Lock must be active or paused' })
  }

  const now = new Date()
  let payload: Record<string, unknown>

  if (loq.status === 'active') {
    payload = { status: 'paused', paused_at: now.toISOString() }
    // TASK-104 — self-pausing a self-loq costs a 5-minute penalty (client
    // ask: discourage loqees from pausing their own honour-based lock).
    // Keyholder-paired loqs are unaffected.
    if (isSelfLoqOwner && loq.loqed_until) {
      payload.loqed_until = new Date(new Date(loq.loqed_until).getTime() + 5 * 60 * 1000).toISOString()
    }
  } else {
    // Resume: restore remaining time from when it was paused
    if (!loq.paused_at || !loq.loqed_until) {
      throw createError({ statusCode: 409, message: 'Invalid pause state' })
    }
    const remaining = new Date(loq.loqed_until).getTime() - new Date(loq.paused_at).getTime()

    if (remaining <= 0) {
      // Time already expired while paused – end the loq
      payload = { status: 'ended', locked: false, ended_at: now.toISOString(), paused_at: null }
    } else {
      payload = {
        status: 'active',
        loqed_until: new Date(now.getTime() + remaining).toISOString(),
        paused_at: null,
      }
    }
  }

  const { data: updated, error } = await supabase
    .from('loqs')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: 'Failed to toggle pause' })

  const action = loq.status === 'active' ? 'loq_paused' : 'loq_resumed'
  await logAudit(supabase, action, user.id, loq.loqee_id, { loq_id: id })

  return updated
})
