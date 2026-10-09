import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { broadcastSignals } from '~/server/utils/broadcastLoq'
import { sendPushNotification } from '~/server/utils/sendPushNotification'
import { isMissed, MAX_PROOF_TEXT, taskPhotoPath } from '~/server/utils/tasks'
import { VERIFICATION_BUCKET } from '~/server/utils/verification'
import { loadVerificationLock, postChat } from '~/server/utils/verificationDb'
import { resolveTask, TASK_COLUMNS, type TaskRow } from '~/server/utils/tasksDb'

// POST /api/loqs/<id>/tasks/<tid>/submit { proof_text? }: the wearer marks a
// task as done, with the proof it asks for. The keyholder then confirms it;
// on a self-lock there is nobody to ask, so it is done right away.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  const tid = getRouterParam(event, 'tid')
  if (!id || !tid) throw createError({ statusCode: 400, message: 'Lock and task ID required' })

  if (!await checkRateLimit(`task-submit:${user.id}`, 20, 60_000)) {
    throw createError({ statusCode: 429, message: 'Too many attempts. Slow down.' })
  }

  const body = await readBody<{ proof_text?: unknown }>(event)
  const proofText = typeof body?.proof_text === 'string' ? body.proof_text.trim() : ''
  if (proofText.length > MAX_PROOF_TEXT) throw createError({ statusCode: 400, message: `Proof too long (max ${MAX_PROOF_TEXT} characters)` })

  const supabase = useSupabaseAdmin()
  const { loq, isWearer, isSelfLock } = await loadVerificationLock(supabase, id, user.id)
  if (!isWearer) throw createError({ statusCode: 403, message: 'Only the wearer can submit a task' })

  const { data: task } = await supabase.from('loq_tasks').select(TASK_COLUMNS).eq('id', tid).eq('loq_id', id).maybeSingle<TaskRow>()
  if (!task) throw createError({ statusCode: 404, message: 'Task not found' })
  if (task.status !== 'open') throw createError({ statusCode: 409, message: 'This task is no longer open' })
  if (isMissed(task)) throw createError({ statusCode: 409, message: 'The deadline has passed' })

  const update: Record<string, unknown> = { submitted_at: new Date().toISOString() }
  if (task.proof === 'text') {
    if (proofText.length < 2) throw createError({ statusCode: 400, message: 'Write a few words as proof' })
    update.proof_text = proofText
  }
  if (task.proof === 'photo') {
    const path = taskPhotoPath(id, tid)
    const { data: files } = await supabase.storage.from(VERIFICATION_BUCKET).list(`${id}/tasks`, { search: `${tid}.jpg`, limit: 1 })
    if (!files?.some(f => f.name === `${tid}.jpg`)) throw createError({ statusCode: 400, message: 'Photo not found. Upload it first.' })
    update.proof_photo_path = path
  }

  if (isSelfLock) {
    await supabase.from('loq_tasks').update(update).eq('id', tid).eq('status', 'open')
    const ok = await resolveTask(supabase, loq, task, 'done', user.id)
    if (!ok) throw createError({ statusCode: 409, message: 'This task is no longer open' })
    return { status: 'done' }
  }

  const { data: claimed } = await supabase
    .from('loq_tasks').update({ ...update, status: 'submitted' }).eq('id', tid).eq('status', 'open').select('id')
  if (!claimed?.length) throw createError({ statusCode: 409, message: 'This task is no longer open' })

  await postChat(supabase, loq, user.id, `📨 Task submitted: ${task.text.slice(0, 80)}`)
  if (loq.loqholder_id) await sendPushNotification(loq.loqholder_id, 'Task submitted', task.text.slice(0, 80), '/dashboard')
  await broadcastSignals(id)
  return { status: 'submitted' }
})
