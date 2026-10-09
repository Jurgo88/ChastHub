import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { isMissed, taskPhotoPath } from '~/server/utils/tasks'
import { VERIFICATION_BUCKET } from '~/server/utils/verification'
import { loadVerificationLock } from '~/server/utils/verificationDb'
import { TASK_COLUMNS, type TaskRow } from '~/server/utils/tasksDb'

// POST /api/loqs/<id>/tasks/<tid>/upload-url: a one-off signed upload URL for
// the proof photo, into the private bucket from the verification photos.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  const tid = getRouterParam(event, 'tid')
  if (!id || !tid) throw createError({ statusCode: 400, message: 'Lock and task ID required' })

  if (!await checkRateLimit(`task-upload:${user.id}`, 10, 60_000)) {
    throw createError({ statusCode: 429, message: 'Too many attempts. Slow down.' })
  }

  const supabase = useSupabaseAdmin()
  const { isWearer } = await loadVerificationLock(supabase, id, user.id)
  if (!isWearer) throw createError({ statusCode: 403, message: 'Only the wearer can upload the proof' })

  const { data: task } = await supabase.from('loq_tasks').select(TASK_COLUMNS).eq('id', tid).eq('loq_id', id).maybeSingle<TaskRow>()
  if (!task) throw createError({ statusCode: 404, message: 'Task not found' })
  if (task.status !== 'open' || isMissed(task)) throw createError({ statusCode: 409, message: 'This task is no longer open' })
  if (task.proof !== 'photo') throw createError({ statusCode: 400, message: 'This task does not take a photo' })

  const path = taskPhotoPath(id, tid)
  const { data, error } = await supabase.storage.from(VERIFICATION_BUCKET).createSignedUploadUrl(path, { upsert: true })
  if (error || !data) {
    console.error('[tasks/upload-url]', error?.message)
    throw createError({ statusCode: 500, message: 'Could not prepare the upload' })
  }
  return { path, token: data.token }
})
