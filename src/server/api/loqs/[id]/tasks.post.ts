import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { sendPushNotification } from '~/server/utils/sendPushNotification'
import { MAX_OPEN_TASKS, newTaskMessage, parseDue, parseTaskInput } from '~/server/utils/tasks'
import { loadVerificationLock, postChat } from '~/server/utils/verificationDb'
import { TASK_COLUMNS } from '~/server/utils/tasksDb'

// POST /api/loqs/<id>/tasks { text, due_at?, proof, reward_minutes, penalty_minutes }:
// the keyholder hands out a task. On a self-lock the wearer sets their own.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const body = await readBody<Record<string, unknown>>(event)
  const input = parseTaskInput(body)
  if (typeof input === 'string') throw createError({ statusCode: 400, message: input })
  const due = parseDue(body?.due_at)
  if (due && typeof due === 'object') throw createError({ statusCode: 400, message: due.error })

  if (!await checkRateLimit(`task-create:${user.id}`, 20, 60_000)) {
    throw createError({ statusCode: 429, message: 'Too many attempts. Slow down.' })
  }

  const supabase = useSupabaseAdmin()
  const { loq, isKeyholder, isSelfLock, isWearer } = await loadVerificationLock(supabase, id, user.id)
  if (!isKeyholder && !(isSelfLock && isWearer)) throw createError({ statusCode: 403, message: 'Only the keyholder can give tasks' })
  if (!['active', 'paused'].includes(loq.status)) throw createError({ statusCode: 409, message: 'Lock is not running' })

  const { count } = await supabase
    .from('loq_tasks').select('id', { count: 'exact', head: true }).eq('loq_id', id).in('status', ['open', 'submitted'])
  if ((count ?? 0) >= MAX_OPEN_TASKS) throw createError({ statusCode: 409, message: `At most ${MAX_OPEN_TASKS} open tasks at a time` })

  const { data: task, error } = await supabase
    .from('loq_tasks')
    .insert({ loq_id: id, created_by: user.id, due_at: due, ...input })
    .select(TASK_COLUMNS)
    .single()
  if (error || !task) throw createError({ statusCode: 500, message: 'Failed to create the task' })

  if (!isSelfLock) {
    await postChat(supabase, loq, user.id, newTaskMessage(input.text, due))
    await sendPushNotification(loq.loqee_id, '📝 New task', input.text.slice(0, 80), '/dashboard')
  }
  return task
})
