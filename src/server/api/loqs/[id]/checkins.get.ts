import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { computeStreak, isValidTimeZone, localParts, pausedDays } from '~/server/utils/checkin'

// GET /api/loqs/<id>/checkins?tz=Europe/Bratislava: recent check-ins, today's
// state and the streak. Wearer and keyholder of the lock only.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const supabase = useSupabaseAdmin()
  const { data: loq } = await supabase
    .from('loqs')
    .select('id, loqee_id, loqholder_id, status, paused_at, checkin_required, checkin_penalty_minutes, checkin_tz')
    .eq('id', id)
    .maybeSingle()
  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  if (loq.loqee_id !== user.id && loq.loqholder_id !== user.id) {
    throw createError({ statusCode: 403, message: 'Access denied' })
  }

  // Each side reads the day in its own zone; the keyholder falls back to the
  // wearer's zone so "today" means the wearer's today for both.
  const asked = getQuery(event).tz
  const tz = loq.loqholder_id === user.id && loq.checkin_tz
    ? loq.checkin_tz
    : isValidTimeZone(asked) ? asked : (loq.checkin_tz ?? 'UTC')
  const today = localParts(Date.now(), tz).date

  const [{ data: rows }, { data: pauses }] = await Promise.all([
    supabase.from('loq_checkins').select('mood, note, local_date, created_at').eq('loq_id', id).order('local_date', { ascending: false }).limit(4000),
    supabase.from('audit_log').select('action, created_at').eq('details->>loq_id', id).in('action', ['loq_paused', 'loq_resumed']).order('created_at', { ascending: true }),
  ])
  const all = rows ?? []

  return {
    today,
    checked_in_today: all.some(r => r.local_date === today),
    streak: computeStreak(
      all.map(r => r.local_date as string),
      today,
      pausedDays((pauses ?? []).map(p => ({ type: p.action === 'loq_paused' ? 'paused' : 'resumed', at: p.created_at as string })), loq.paused_at, tz),
    ),
    required: loq.checkin_required,
    penalty_minutes: loq.checkin_penalty_minutes,
    last: all[0] ?? null,
    recent: all.slice(0, 14),
  }
})
