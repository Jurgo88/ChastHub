import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { logAudit } from '~/server/utils/auditLog'
import { broadcastSignals } from '~/server/utils/broadcastLoq'
import { sendPushNotification } from '~/server/utils/sendPushNotification'
import { canTransition, MAX_PENALTY_MINUTES, MAX_REVIEW_NOTE, type VerificationStatus } from '~/server/utils/verification'
import { addPenalty, loadVerificationLock, postChat, VERIFICATION_COLUMNS, type VerificationRow } from '~/server/utils/verificationDb'

// POST /api/loqs/<id>/verifications/<vid>/review { decision, note?, penalty_minutes? }:
// the keyholder approves or rejects the photo. A rejection can add time.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  const vid = getRouterParam(event, 'vid')
  if (!id || !vid) throw createError({ statusCode: 400, message: 'Lock and verification ID required' })

  const body = await readBody<{ decision?: unknown; note?: unknown; penalty_minutes?: unknown }>(event)
  if (body?.decision !== 'approve' && body?.decision !== 'reject') {
    throw createError({ statusCode: 400, message: 'decision must be approve or reject' })
  }
  const note = typeof body.note === 'string' ? body.note.trim() : ''
  if (note.length > MAX_REVIEW_NOTE) throw createError({ statusCode: 400, message: `Note too long (max ${MAX_REVIEW_NOTE} characters)` })
  const penalty = body.decision === 'reject' && body.penalty_minutes !== undefined ? body.penalty_minutes : 0
  if (typeof penalty !== 'number' || !Number.isInteger(penalty) || penalty < 0 || penalty > MAX_PENALTY_MINUTES) {
    throw createError({ statusCode: 400, message: `penalty_minutes must be a whole number from 0 to ${MAX_PENALTY_MINUTES}` })
  }

  const supabase = useSupabaseAdmin()
  const { loq, isKeyholder } = await loadVerificationLock(supabase, id, user.id)
  if (!isKeyholder) throw createError({ statusCode: 403, message: 'Only the keyholder can review' })

  const { data: v } = await supabase
    .from('loq_verifications').select(VERIFICATION_COLUMNS).eq('id', vid).eq('loq_id', id).maybeSingle<VerificationRow>()
  if (!v) throw createError({ statusCode: 404, message: 'Verification not found' })

  const next: VerificationStatus = body.decision === 'approve' ? 'approved' : 'rejected'
  if (!canTransition(v.status as VerificationStatus, next)) throw createError({ statusCode: 409, message: 'Nothing to review' })

  const { data: updated } = await supabase
    .from('loq_verifications')
    .update({ status: next, reviewed_at: new Date().toISOString(), review_note: note || null })
    .eq('id', vid)
    .eq('status', 'submitted')
    .select('id')
  if (!updated?.length) throw createError({ statusCode: 409, message: 'Nothing to review' })

  if (next === 'approved') {
    await logAudit(supabase, 'loq_verification_approved', user.id, loq.loqee_id, { loq_id: id })
    await postChat(supabase, loq, user.id, '✅ Verification approved.')
    await sendPushNotification(loq.loqee_id, 'Verification approved', 'Your keyholder approved your photo.', '/dashboard')
  }
  else {
    await logAudit(supabase, 'loq_verification_rejected', user.id, loq.loqee_id, { loq_id: id })
    await addPenalty(supabase, loq, penalty, 'rejected_verification', user.id)
    const extra = penalty > 0 ? ` +${penalty} min added.` : ''
    await postChat(supabase, loq, user.id, `❌ Verification rejected${note ? `: ${note}` : '.'}${extra}`)
    await sendPushNotification(loq.loqee_id, 'Verification rejected', note || 'Your keyholder rejected the photo.', '/dashboard')
  }
  await broadcastSignals(id)
  return { status: next }
})
