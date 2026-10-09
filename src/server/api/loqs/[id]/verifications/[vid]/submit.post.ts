import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { logAudit } from '~/server/utils/auditLog'
import { broadcastSignals } from '~/server/utils/broadcastLoq'
import { sendPushNotification } from '~/server/utils/sendPushNotification'
import { canTransition, isPastDue, photoPath, VERIFICATION_BUCKET, type VerificationStatus } from '~/server/utils/verification'
import { loadVerificationLock, postChat, VERIFICATION_COLUMNS, type VerificationRow } from '~/server/utils/verificationDb'

// POST /api/loqs/<id>/verifications/<vid>/submit: the wearer says the photo is
// uploaded. We check it really is in the bucket, then hand it to the keyholder.
// On a self-lock there is nobody to approve it, so it is approved on the spot
// and stays as a diary entry.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  const vid = getRouterParam(event, 'vid')
  if (!id || !vid) throw createError({ statusCode: 400, message: 'Lock and verification ID required' })

  const supabase = useSupabaseAdmin()
  const { loq, isWearer, isSelfLock } = await loadVerificationLock(supabase, id, user.id)
  if (!isWearer) throw createError({ statusCode: 403, message: 'Only the wearer can submit the photo' })

  const { data: v } = await supabase
    .from('loq_verifications').select(VERIFICATION_COLUMNS).eq('id', vid).eq('loq_id', id).maybeSingle<VerificationRow>()
  if (!v) throw createError({ statusCode: 404, message: 'Verification not found' })
  const next: VerificationStatus = isSelfLock ? 'approved' : 'submitted'
  if (!canTransition(v.status as VerificationStatus, 'submitted')) {
    throw createError({ statusCode: 409, message: 'This request is no longer open' })
  }
  if (isPastDue(v.due_at)) throw createError({ statusCode: 409, message: 'This request has run out of time' })

  const path = photoPath(id, vid)
  const { data: files } = await supabase.storage.from(VERIFICATION_BUCKET).list(id, { search: `${vid}.jpg`, limit: 1 })
  if (!files?.some(f => f.name === `${vid}.jpg`)) throw createError({ statusCode: 400, message: 'Photo not found. Upload it first.' })

  const now = new Date().toISOString()
  // The status filter makes a double tap or an overlapping cron run harmless.
  const { data: updated } = await supabase
    .from('loq_verifications')
    .update({ status: next, photo_path: path, submitted_at: now, ...(isSelfLock ? { reviewed_at: now } : {}) })
    .eq('id', vid)
    .eq('status', 'pending')
    .select('id')
  if (!updated?.length) throw createError({ statusCode: 409, message: 'This request is no longer open' })

  if (loq.loqholder_id) {
    await postChat(supabase, loq, user.id, `📸 Verification photo sent (code ${v.code}). Waiting for your review.`)
    await sendPushNotification(loq.loqholder_id, 'Verification photo', 'Your wearer sent a photo. Tap to review it.', '/dashboard')
  }
  else {
    await logAudit(supabase, 'loq_verification_approved', user.id, loq.loqee_id, { loq_id: id, self: true })
  }
  await broadcastSignals(id)
  return { status: next }
})
