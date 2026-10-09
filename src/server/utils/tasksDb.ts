import type { SupabaseClient } from '@supabase/supabase-js'
import { logAudit } from '~/server/utils/auditLog'
import { broadcastSignals } from '~/server/utils/broadcastLoq'
import { applyTimeDelta } from '~/server/utils/lockTime'
import { sendPushNotification } from '~/server/utils/sendPushNotification'
import { doneMessage, effectiveReward, failedMessage, type TaskStatus } from '~/server/utils/tasks'
import { postChat, type VerificationLock } from '~/server/utils/verificationDb'

export interface TaskRow {
  id: string
  loq_id: string
  created_by: string | null
  text: string
  due_at: string | null
  proof: 'none' | 'text' | 'photo'
  reward_minutes: number
  penalty_minutes: number
  status: TaskStatus
  proof_text: string | null
  proof_photo_path: string | null
  submitted_at: string | null
  resolved_at: string | null
  reminded_at: string | null
  created_at: string
}

export const TASK_COLUMNS = 'id, loq_id, created_by, text, due_at, proof, reward_minutes, penalty_minutes, status, proof_text, proof_photo_path, submitted_at, resolved_at, reminded_at, created_at'

/**
 * Settles a task as done (reward) or failed (penalty). The status filter on
 * the update claims the task, so a double tap, the cron and the keyholder can
 * never settle it twice. Returns false when someone else got there first.
 */
export async function resolveTask(
  supabase: SupabaseClient,
  loq: VerificationLock,
  task: TaskRow,
  outcome: 'done' | 'failed',
  actorId: string,
  opts: { missed?: boolean; auto?: boolean } = {},
): Promise<boolean> {
  const { data: claimed } = await supabase
    .from('loq_tasks')
    .update({ status: outcome, resolved_at: new Date().toISOString() })
    .eq('id', task.id)
    .eq('status', task.status)
    .select('id')
  if (!claimed?.length) return false

  const selfLock = !loq.loqholder_id
  if (outcome === 'done') {
    const applied = await applyTimeDelta(supabase, loq, -effectiveReward(task.reward_minutes, selfLock), 'task_reward', actorId)
    await logAudit(supabase, 'loq_task_done', actorId, loq.loqee_id, { loq_id: loq.id, task_id: task.id, auto: !!opts.auto })
    await postChat(supabase, loq, actorId, doneMessage(task.text, applied) + (opts.auto ? ' (approved automatically after 24h)' : ''))
    await sendPushNotification(loq.loqee_id, 'Task done ✅', applied < 0 ? `${-applied} min taken off` : task.text.slice(0, 80), '/dashboard')
  }
  else {
    const applied = await applyTimeDelta(supabase, loq, task.penalty_minutes, opts.missed ? 'task_missed' : 'task_failed', actorId)
    await logAudit(supabase, 'loq_task_failed', actorId, loq.loqee_id, { loq_id: loq.id, task_id: task.id, missed: !!opts.missed })
    await postChat(supabase, loq, actorId, failedMessage(task.text, applied, !!opts.missed))
    await sendPushNotification(loq.loqee_id, opts.missed ? 'Task missed' : 'Task failed', applied > 0 ? `+${applied} min added` : task.text.slice(0, 80), '/dashboard')
  }
  await broadcastSignals(loq.id)
  return true
}
