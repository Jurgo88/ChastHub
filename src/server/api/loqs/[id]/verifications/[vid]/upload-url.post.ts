import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { isPastDue, photoPath, VERIFICATION_BUCKET } from '~/server/utils/verification'
import { loadVerificationLock, VERIFICATION_COLUMNS, type VerificationRow } from '~/server/utils/verificationDb'

// POST /api/loqs/<id>/verifications/<vid>/upload-url: a one-off signed upload
// URL for the verification photo. The bucket has no policies, so this is the
// only way in, and only for the wearer of this lock while the request is open.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  const vid = getRouterParam(event, 'vid')
  if (!id || !vid) throw createError({ statusCode: 400, message: 'Lock and verification ID required' })

  if (!await checkRateLimit(`verification-upload:${user.id}`, 10, 60_000)) {
    throw createError({ statusCode: 429, message: 'Too many attempts. Slow down.' })
  }

  const supabase = useSupabaseAdmin()
  const { isWearer } = await loadVerificationLock(supabase, id, user.id)
  if (!isWearer) throw createError({ statusCode: 403, message: 'Only the wearer can upload the photo' })

  const { data: v } = await supabase
    .from('loq_verifications').select(VERIFICATION_COLUMNS).eq('id', vid).eq('loq_id', id).maybeSingle<VerificationRow>()
  if (!v) throw createError({ statusCode: 404, message: 'Verification not found' })
  if (v.status !== 'pending') throw createError({ statusCode: 409, message: 'This request is no longer open' })
  if (isPastDue(v.due_at)) throw createError({ statusCode: 409, message: 'This request has run out of time' })

  const path = photoPath(id, vid)
  const { data, error } = await supabase.storage.from(VERIFICATION_BUCKET).createSignedUploadUrl(path, { upsert: true })
  if (error || !data) {
    console.error('[verification/upload-url]', error?.message)
    throw createError({ statusCode: 500, message: 'Could not prepare the upload' })
  }
  return { path, token: data.token }
})
