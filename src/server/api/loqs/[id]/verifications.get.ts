import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { VERIFICATION_BUCKET } from '~/server/utils/verification'
import { loadVerificationLock, VERIFICATION_COLUMNS, type VerificationRow } from '~/server/utils/verificationDb'

const SIGNED_URL_SECONDS = 300

// GET /api/loqs/<id>/verifications: recent requests, the open one and the
// random-daily settings. Photos come back as short-lived signed URLs, and only
// to the keyholder (or to the wearer of a self-lock, who keeps them as a diary).
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const supabase = useSupabaseAdmin()
  const { isKeyholder, isSelfLock } = await loadVerificationLock(supabase, id, user.id)
  const canSeePhotos = isKeyholder || isSelfLock

  const [{ data: rows }, { data: settings }] = await Promise.all([
    supabase.from('loq_verifications').select(VERIFICATION_COLUMNS).eq('loq_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('loq_verification_settings').select('random_daily, window_start, window_end, tz, due_minutes, penalty_minutes').eq('loq_id', id).maybeSingle(),
  ])

  const items = await Promise.all(((rows ?? []) as VerificationRow[]).map(async (r) => {
    let photo_url: string | null = null
    if (canSeePhotos && r.photo_path) {
      const { data } = await supabase.storage.from(VERIFICATION_BUCKET).createSignedUrl(r.photo_path, SIGNED_URL_SECONDS)
      photo_url = data?.signedUrl ?? null
    }
    return {
      id: r.id,
      code: r.code,
      due_at: r.due_at,
      penalty_minutes: r.penalty_minutes,
      status: r.status,
      automatic: r.requested_by === null,
      has_photo: !!r.photo_path,
      photo_url,
      submitted_at: r.submitted_at,
      reviewed_at: r.reviewed_at,
      review_note: r.review_note,
      created_at: r.created_at,
    }
  }))

  return {
    items,
    open: items.find(i => i.status === 'pending' || i.status === 'submitted') ?? null,
    settings: settings ?? null,
    self_lock: isSelfLock,
  }
})
