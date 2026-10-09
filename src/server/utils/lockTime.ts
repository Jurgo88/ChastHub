import type { SupabaseClient } from '@supabase/supabase-js'
import { logAudit } from '~/server/utils/auditLog'
import { MAX_DURATION_MINUTES } from '~/server/utils/loqValidation'

/**
 * Where the end of the lock lands after moving it by `deltaMinutes`, held to
 * the same limits as the keyholder's own time buttons (time.post.ts): never
 * past the maximum length, never closer than one minute from now. Null when
 * the move would change nothing.
 */
export function shiftedUntil(currentUntil: string | number | Date, deltaMinutes: number, now = Date.now()): number | null {
  const current = new Date(currentUntil).getTime()
  const max = now + MAX_DURATION_MINUTES * 60_000
  const min = now + 60_000
  const target = Math.min(Math.max(current + deltaMinutes * 60_000, min), max)
  // A reward on a lock that is already almost over must not push it later.
  if (deltaMinutes < 0 && target >= current) return null
  if (deltaMinutes > 0 && target <= current) return null
  return target
}

/**
 * Moves the end of a lock by a reward (negative) or a penalty (positive) and
 * writes the same audit row the time buttons do, with the reason attached.
 * Returns the minutes actually applied (a reward can be cut short by the
 * one-minute floor).
 */
export async function applyTimeDelta(
  supabase: SupabaseClient,
  loq: { id: string; loqee_id: string },
  deltaMinutes: number,
  reason: string,
  actorId: string,
): Promise<number> {
  if (!deltaMinutes) return 0
  const { data: fresh } = await supabase.from('loqs').select('loqed_until').eq('id', loq.id).maybeSingle()
  if (!fresh?.loqed_until) return 0
  const current = new Date(fresh.loqed_until as string).getTime()
  const target = shiftedUntil(current, deltaMinutes)
  if (target === null) return 0

  await supabase.from('loqs').update({ loqed_until: new Date(target).toISOString() }).eq('id', loq.id)
  const applied = Math.round((target - current) / 60_000)
  await logAudit(supabase, applied > 0 ? 'loq_time_added' : 'loq_time_removed', actorId, loq.loqee_id, {
    loq_id: loq.id, delta_minutes: applied, reason,
  })
  return applied
}
