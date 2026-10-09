import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { VERIFICATION_BUCKET } from '~/server/utils/verification'
import { loadVerificationLock } from '~/server/utils/verificationDb'
import { TASK_COLUMNS, type TaskRow } from '~/server/utils/tasksDb'

const SIGNED_URL_SECONDS = 300

// GET /api/loqs/<id>/tasks: open tasks (soonest deadline first) and the
// recently settled ones. Proof photos come back as short-lived signed URLs to
// the keyholder, or to the wearer of a self-lock.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const supabase = useSupabaseAdmin()
  const { isKeyholder, isSelfLock } = await loadVerificationLock(supabase, id, user.id)
  const canSeePhotos = isKeyholder || isSelfLock

  const { data } = await supabase
    .from('loq_tasks').select(TASK_COLUMNS).eq('loq_id', id).order('created_at', { ascending: false }).limit(60)
  const rows = (data ?? []) as TaskRow[]

  const view = async (t: TaskRow) => {
    let photo_url: string | null = null
    if (canSeePhotos && t.proof_photo_path) {
      const { data: signed } = await supabase.storage.from(VERIFICATION_BUCKET).createSignedUrl(t.proof_photo_path, SIGNED_URL_SECONDS)
      photo_url = signed?.signedUrl ?? null
    }
    const { proof_photo_path: _p, reminded_at: _r, created_by: _c, ...rest } = t
    return { ...rest, has_photo: !!t.proof_photo_path, photo_url }
  }

  const open = rows
    .filter(t => t.status === 'open' || t.status === 'submitted')
    .sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999'))
  const settled = rows.filter(t => t.status !== 'open' && t.status !== 'submitted').slice(0, 10)

  return {
    open: await Promise.all(open.map(view)),
    settled: await Promise.all(settled.map(view)),
    can_manage: isKeyholder || isSelfLock,
    self_lock: isSelfLock,
  }
})
