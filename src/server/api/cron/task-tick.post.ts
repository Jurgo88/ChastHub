import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireCronAuth } from '~/server/utils/cronAuth'
import { sendPushNotification } from '~/server/utils/sendPushNotification'
import { AUTO_APPROVE_AFTER_MS, REMINDER_BEFORE_MS } from '~/server/utils/tasks'
import { PHOTO_RETENTION_DAYS, VERIFICATION_BUCKET } from '~/server/utils/verification'
import type { VerificationLock } from '~/server/utils/verificationDb'
import { resolveTask, TASK_COLUMNS, type TaskRow } from '~/server/utils/tasksDb'

// Called every few minutes by netlify/functions/lounge-tick.mts:
//   - fails open tasks whose deadline passed, with the penalty;
//   - reminds the wearer an hour before a deadline, once;
//   - approves a submitted task the keyholder left alone for 24 hours;
//   - cancels open tasks of locks that are over, without penalties;
//   - once an hour, deletes proof photos of locks over for 30 days.
// A paused lock is left alone: its deadlines wait for it.
export default defineEventHandler(async (event) => {
  requireCronAuth(event)

  const supabase = useSupabaseAdmin()
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const LOCK_JOIN = 'loqs!inner(id, loqee_id, loqholder_id, status, loqed_until)'
  type Joined = TaskRow & { loqs: VerificationLock }
  const actorOf = (loq: VerificationLock) => loq.loqholder_id ?? loq.loqee_id

  // ── Missed deadlines ──────────────────────────────────────────────────────
  const { data: late } = await supabase
    .from('loq_tasks')
    .select(`${TASK_COLUMNS}, ${LOCK_JOIN}`)
    .eq('status', 'open')
    .lte('due_at', nowIso)
    .eq('loqs.status', 'active')
    .limit(500)
  let failed = 0
  for (const t of (late ?? []) as unknown as Joined[]) {
    if (await resolveTask(supabase, t.loqs, t, 'failed', actorOf(t.loqs), { missed: true })) failed++
  }

  // ── One-hour reminders ────────────────────────────────────────────────────
  const { data: soon } = await supabase
    .from('loq_tasks')
    .select(`id, text, loqs!inner(loqee_id, status)`)
    .eq('status', 'open')
    .is('reminded_at', null)
    .gt('due_at', nowIso)
    .lte('due_at', new Date(now + REMINDER_BEFORE_MS).toISOString())
    .eq('loqs.status', 'active')
    .limit(500)
  let reminded = 0
  for (const t of (soon ?? []) as unknown as { id: string; text: string; loqs: { loqee_id: string } }[]) {
    const { data: claimed } = await supabase
      .from('loq_tasks').update({ reminded_at: nowIso }).eq('id', t.id).is('reminded_at', null).select('id')
    if (!claimed?.length) continue
    await sendPushNotification(t.loqs.loqee_id, '⏳ Task due within an hour', t.text.slice(0, 80), '/dashboard')
    reminded++
  }

  // ── Keyholder silent for 24 hours ─────────────────────────────────────────
  const { data: waiting } = await supabase
    .from('loq_tasks')
    .select(`${TASK_COLUMNS}, ${LOCK_JOIN}`)
    .eq('status', 'submitted')
    .lte('submitted_at', new Date(now - AUTO_APPROVE_AFTER_MS).toISOString())
    .in('loqs.status', ['active', 'paused'])
    .limit(500)
  let approved = 0
  for (const t of (waiting ?? []) as unknown as Joined[]) {
    if (await resolveTask(supabase, t.loqs, t, 'done', actorOf(t.loqs), { auto: true })) approved++
  }

  // ── Locks that are over ───────────────────────────────────────────────────
  const { data: orphaned } = await supabase
    .from('loq_tasks')
    .select('id, loqs!inner(status)')
    .in('status', ['open', 'submitted'])
    .in('loqs.status', ['ended', 'cancelled'])
    .limit(1000)
  let cancelled = 0
  const orphanIds = (orphaned ?? []).map(t => t.id as string)
  if (orphanIds.length) {
    await supabase.from('loq_tasks').update({ status: 'cancelled', resolved_at: nowIso }).in('id', orphanIds).in('status', ['open', 'submitted'])
    cancelled = orphanIds.length
  }

  // ── Old proof photos ──────────────────────────────────────────────────────
  let deleted = 0
  if (new Date(now).getUTCMinutes() < 5) {
    const cutoff = now - PHOTO_RETENTION_DAYS * 86_400_000
    const { data: old } = await supabase
      .from('loq_tasks')
      .select('id, proof_photo_path, loqs!inner(status, ended_at, loqed_until, created_at)')
      .not('proof_photo_path', 'is', null)
      .in('loqs.status', ['ended', 'cancelled'])
      .limit(500)
    const stale = ((old ?? []) as unknown as { id: string; proof_photo_path: string; loqs: { ended_at: string | null; loqed_until: string | null; created_at: string } }[])
      .filter(r => new Date(r.loqs.ended_at ?? r.loqs.loqed_until ?? r.loqs.created_at).getTime() < cutoff)
    if (stale.length) {
      const { error } = await supabase.storage.from(VERIFICATION_BUCKET).remove(stale.map(r => r.proof_photo_path))
      if (!error) {
        await supabase.from('loq_tasks').update({ proof_photo_path: null }).in('id', stale.map(r => r.id))
        deleted = stale.length
      }
    }
  }

  return { failed, reminded, approved, cancelled, deleted }
})
