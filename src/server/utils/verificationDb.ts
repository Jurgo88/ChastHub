import { randomInt } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { applyTimeDelta } from '~/server/utils/lockTime'
import { sendPushNotification } from '~/server/utils/sendPushNotification'
import { generateCode, requestMessage } from '~/server/utils/verification'

export interface VerificationLock {
  id: string
  loqee_id: string
  loqholder_id: string | null
  status: string
  loqed_until: string | null
}

export interface VerificationRow {
  id: string
  loq_id: string
  requested_by: string | null
  code: string
  due_at: string
  penalty_minutes: number
  status: string
  photo_path: string | null
  submitted_at: string | null
  reviewed_at: string | null
  review_note: string | null
  created_at: string
}

export const VERIFICATION_COLUMNS = 'id, loq_id, requested_by, code, due_at, penalty_minutes, status, photo_path, submitted_at, reviewed_at, review_note, created_at'
const LOCK_COLUMNS = 'id, loqee_id, loqholder_id, status, loqed_until'

/**
 * The lock and the caller's side of it. A self-lock has no keyholder: the
 * wearer then acts as both, and nothing needs approving.
 */
export async function loadVerificationLock(supabase: SupabaseClient, loqId: string, userId: string) {
  const { data: loq } = await supabase.from('loqs').select(LOCK_COLUMNS).eq('id', loqId).maybeSingle<VerificationLock>()
  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  const isWearer = loq.loqee_id === userId
  const isKeyholder = loq.loqholder_id === userId
  if (!isWearer && !isKeyholder) throw createError({ statusCode: 403, message: 'Access denied' })
  return { loq, isWearer, isKeyholder, isSelfLock: !loq.loqholder_id }
}

/** Creates a pending request, tells the wearer. Shared by the API and the random schedule. */
export async function createVerification(
  supabase: SupabaseClient,
  loq: VerificationLock,
  opts: { requestedBy: string | null; dueMinutes: number; penaltyMinutes: number },
): Promise<VerificationRow | null> {
  const dueAt = new Date(Date.now() + opts.dueMinutes * 60_000).toISOString()
  const { data, error } = await supabase
    .from('loq_verifications')
    .insert({
      loq_id: loq.id,
      requested_by: opts.requestedBy,
      code: generateCode(randomInt),
      due_at: dueAt,
      penalty_minutes: opts.penaltyMinutes,
    })
    .select(VERIFICATION_COLUMNS)
    .single<VerificationRow>()
  if (error || !data) {
    console.error('[verification] insert failed:', error?.message)
    return null
  }

  const text = requestMessage(data.code, opts.dueMinutes)
  const sender = opts.requestedBy ?? loq.loqholder_id
  if (loq.loqholder_id && sender) {
    await supabase.from('messages').insert({
      loq_id: loq.id, sender_id: sender, content: text, loqee_id: loq.loqee_id, loqholder_id: loq.loqholder_id,
    })
  }
  await sendPushNotification(loq.loqee_id, 'Verification requested', `Code ${data.code}, due in ${opts.dueMinutes >= 60 ? `${Math.round(opts.dueMinutes / 60 * 10) / 10}h` : `${opts.dueMinutes}m`}`, '/dashboard')
  return data
}

/** Adds penalty time to the lock the same way the keyholder's own time button does. */
export async function addPenalty(
  supabase: SupabaseClient,
  loq: VerificationLock,
  minutes: number,
  reason: 'missed_verification' | 'rejected_verification',
  actorId: string,
): Promise<void> {
  if (minutes <= 0) return
  await applyTimeDelta(supabase, loq, minutes, reason, actorId)
}

/** One line in the lock chat, as the keyholder. No-op for a self-lock. */
export async function postChat(supabase: SupabaseClient, loq: VerificationLock, senderId: string, content: string) {
  if (!loq.loqholder_id) return
  await supabase.from('messages').insert({
    loq_id: loq.id, sender_id: senderId, content, loqee_id: loq.loqee_id, loqholder_id: loq.loqholder_id,
  })
}
