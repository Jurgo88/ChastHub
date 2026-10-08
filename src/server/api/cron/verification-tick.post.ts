import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireCronAuth } from '~/server/utils/cronAuth'
import { logAudit } from '~/server/utils/auditLog'
import { sendPushNotification } from '~/server/utils/sendPushNotification'
import { nextAutoTime, PHOTO_RETENTION_DAYS, VERIFICATION_BUCKET } from '~/server/utils/verification'
import { addPenalty, createVerification, postChat, type VerificationLock } from '~/server/utils/verificationDb'

// Called every few minutes by netlify/functions/lounge-tick.mts:
//   - marks requests whose time ran out as expired and applies the penalty;
//   - creates the keyholder's random daily requests inside their window;
//   - once an hour, deletes photos of locks that ended more than 30 days ago.
// A paused lock is left alone: the clock is stopped, so nothing can be missed.
export default defineEventHandler(async (event) => {
  requireCronAuth(event)

  const supabase = useSupabaseAdmin()
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const LOCK_JOIN = 'loqs!inner(id, loqee_id, loqholder_id, status, loqed_until)'

  // ── Missed requests ───────────────────────────────────────────────────────
  const { data: late } = await supabase
    .from('loq_verifications')
    .select(`id, loq_id, code, requested_by, penalty_minutes, ${LOCK_JOIN}`)
    .eq('status', 'pending')
    .lte('due_at', nowIso)
    .eq('loqs.status', 'active')
    .limit(500)

  let expired = 0
  for (const v of (late ?? []) as unknown as (Record<string, unknown> & { loqs: VerificationLock })[]) {
    const loq = v.loqs
    // Claim it first so an overlapping tick cannot penalise twice.
    const { data: claimed } = await supabase
      .from('loq_verifications').update({ status: 'expired' }).eq('id', v.id as string).eq('status', 'pending').select('id')
    if (!claimed?.length) continue

    const actor = loq.loqholder_id ?? loq.loqee_id
    const penalty = Number(v.penalty_minutes) || 0
    await logAudit(supabase, 'loq_verification_missed', actor, loq.loqee_id, { loq_id: loq.id })
    await addPenalty(supabase, loq, penalty, 'missed_verification', actor)
    await postChat(supabase, loq, actor, `⏰ Missed verification (code ${v.code})${penalty > 0 ? `: +${penalty} min` : ''}`)
    await sendPushNotification(loq.loqee_id, 'Missed verification', penalty > 0 ? `+${penalty} min added` : 'You did not send the photo in time.', '/dashboard')
    expired++
  }

  // ── Random daily requests ─────────────────────────────────────────────────
  const { data: due } = await supabase
    .from('loq_verification_settings')
    .select(`loq_id, window_start, window_end, tz, due_minutes, penalty_minutes, next_auto_at, ${LOCK_JOIN}`)
    .eq('random_daily', true)
    .or(`next_auto_at.is.null,next_auto_at.lte.${nowIso}`)
    .eq('loqs.status', 'active')
    .limit(500)

  let created = 0
  for (const s of (due ?? []) as unknown as (Record<string, unknown> & { loqs: VerificationLock })[]) {
    const loq = s.loqs
    const start = (s.window_start as string).slice(0, 5)
    const end = (s.window_end as string).slice(0, 5)
    const next = new Date(nextAutoTime(now, start, end, s.tz as string, Math.random)).toISOString()

    // Claim the slot: only one overlapping tick gets to move next_auto_at.
    let claim = supabase.from('loq_verification_settings').update({ next_auto_at: next }).eq('loq_id', loq.id)
    claim = s.next_auto_at ? claim.eq('next_auto_at', s.next_auto_at as string) : claim.is('next_auto_at', null)
    const { data: claimed } = await claim.select('loq_id')
    // A null next_auto_at only needed a first roll; a due one also fires.
    if (!claimed?.length || !s.next_auto_at) continue

    const { data: open } = await supabase
      .from('loq_verifications').select('id').eq('loq_id', loq.id).in('status', ['pending', 'submitted']).limit(1)
    if (open?.length) continue

    if (await createVerification(supabase, loq, {
      requestedBy: null, dueMinutes: Number(s.due_minutes), penaltyMinutes: Number(s.penalty_minutes),
    })) created++
  }

  // ── Old photos ────────────────────────────────────────────────────────────
  let deleted = 0
  if (new Date(now).getUTCMinutes() < 5) {
    const cutoff = now - PHOTO_RETENTION_DAYS * 86_400_000
    const { data: old } = await supabase
      .from('loq_verifications')
      .select('id, photo_path, loqs!inner(status, ended_at, loqed_until, created_at)')
      .not('photo_path', 'is', null)
      .in('loqs.status', ['ended', 'cancelled'])
      .limit(500)
    const stale = ((old ?? []) as unknown as { id: string; photo_path: string; loqs: { ended_at: string | null; loqed_until: string | null; created_at: string } }[])
      .filter(r => new Date(r.loqs.ended_at ?? r.loqs.loqed_until ?? r.loqs.created_at).getTime() < cutoff)
    if (stale.length) {
      const { error } = await supabase.storage.from(VERIFICATION_BUCKET).remove(stale.map(r => r.photo_path))
      if (!error) {
        await supabase.from('loq_verifications').update({ photo_path: null }).in('id', stale.map(r => r.id))
        deleted = stale.length
      }
    }
  }

  return { expired, created, deleted }
})
