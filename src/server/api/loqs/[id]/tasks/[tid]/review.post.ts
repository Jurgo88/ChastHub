import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { canTransitionTask } from '~/server/utils/tasks'
import { loadVerificationLock } from '~/server/utils/verificationDb'
import { resolveTask, TASK_COLUMNS, type TaskRow } from '~/server/utils/tasksDb'

// POST /api/loqs/<id>/tasks/<tid>/review { decision: 'done' | 'failed' }: the
// keyholder confirms a task (reward) or fails it (penalty). An open task can
// be settled too, e.g. when it was done in person.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  const tid = getRouterParam(event, 'tid')
  if (!id || !tid) throw createError({ statusCode: 400, message: 'Lock and task ID required' })

  const body = await readBody<{ decision?: unknown }>(event)
  if (body?.decision !== 'done' && body?.decision !== 'failed') {
    throw createError({ statusCode: 400, message: 'decision must be done or failed' })
  }

  const supabase = useSupabaseAdmin()
  const { loq, isKeyholder } = await loadVerificationLock(supabase, id, user.id)
  if (!isKeyholder) throw createError({ statusCode: 403, message: 'Only the keyholder can review tasks' })

  const { data: task } = await supabase.from('loq_tasks').select(TASK_COLUMNS).eq('id', tid).eq('loq_id', id).maybeSingle<TaskRow>()
  if (!task) throw createError({ statusCode: 404, message: 'Task not found' })
  if (!canTransitionTask(task.status, body.decision)) throw createError({ statusCode: 409, message: 'This task is already settled' })

  const ok = await resolveTask(supabase, loq, task, body.decision, user.id)
  if (!ok) throw createError({ statusCode: 409, message: 'This task is already settled' })
  return { status: body.decision }
})
