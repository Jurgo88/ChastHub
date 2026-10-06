import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireCronAuth } from '~/server/utils/cronAuth'
import { sendPushNotification } from '~/server/utils/sendPushNotification'
import { logAudit } from '~/server/utils/auditLog'
import { MAX_DURATION_MINUTES } from '~/server/utils/loqValidation'
import { dayToSettle, localParts, reminderDue } from '~/server/utils/checkin'

// Called every few minutes by netlify/functions/lounge-tick.mts. For every
// running lock whose wearer has checked in before it:
//   - sends the evening reminder once per local day;
//   - when the keyholder made check-ins compulsory, applies the penalty once
//     for yesterday if it was missed.
// Paused locks are left alone: a paused day cannot be missed.
export default defineEventHandler(async (event) => {
  requireCronAuth(event)

  const supabase = useSupabaseAdmin()
  const { data: locks } = await supabase
    .from('loqs')
    .select('id, loqee_id, loqholder_id, created_at, loqed_until, checkin_required, checkin_penalty_minutes, checkin_tz, checkin_penalty_through, checkin_reminded_on')
    .eq('status', 'active')
    .not('checkin_tz', 'is', null)
    .limit(2000)

  let reminded = 0
  let penalised = 0
  const now = Date.now()

  for (const loq of locks ?? []) {
    const tz = loq.checkin_tz as string
    const { date: today, hour } = localParts(now, tz)

    const { data: todays } = await supabase.from('loq_checkins').select('id').eq('loq_id', loq.id).eq('local_date', today).limit(1)

    if (reminderDue(hour, today, !!todays?.length, loq.checkin_reminded_on)) {
      // Claim the day first so an overlapping tick cannot send it twice.
      const { data: claimed } = await supabase
        .from('loqs')
        .update({ checkin_reminded_on: today })
        .eq('id', loq.id)
        .or(`checkin_reminded_on.is.null,checkin_reminded_on.neq.${today}`)
        .select('id')
      if (claimed?.length) {
        await sendPushNotification(loq.loqee_id, 'Daily check-in', 'How are you feeling today? Tap to check in.', '/dashboard')
        reminded++
      }
    }

    if (!loq.checkin_required || !loq.checkin_penalty_minutes || !loq.loqholder_id) continue
    const createdDay = localParts(new Date(loq.created_at).getTime(), tz).date
    const day = dayToSettle(today, createdDay, loq.checkin_penalty_through)
    if (!day) continue

    const { data: claimed } = await supabase
      .from('loqs')
      .update({ checkin_penalty_through: day })
      .eq('id', loq.id)
      .select('id')
    if (!claimed?.length) continue

    const { data: had } = await supabase.from('loq_checkins').select('id').eq('loq_id', loq.id).eq('local_date', day).limit(1)
    if (had?.length || !loq.loqed_until) continue

    const cap = now + MAX_DURATION_MINUTES * 60_000
    const newUntil = Math.min(new Date(loq.loqed_until).getTime() + loq.checkin_penalty_minutes * 60_000, cap)
    await supabase.from('loqs').update({ loqed_until: new Date(newUntil).toISOString() }).eq('id', loq.id)
    await logAudit(supabase, 'loq_time_added', loq.loqholder_id, loq.loqee_id, {
      loq_id: loq.id, delta_minutes: loq.checkin_penalty_minutes, reason: 'missed_checkin', day,
    })
    await supabase.from('messages').insert({
      loq_id: loq.id,
      sender_id: loq.loqholder_id,
      content: `⏰ Missed check-in on ${day}: +${loq.checkin_penalty_minutes} min`,
      loqee_id: loq.loqee_id,
      loqholder_id: loq.loqholder_id,
    })
    await sendPushNotification(loq.loqee_id, 'Missed check-in', `+${loq.checkin_penalty_minutes} min added for ${day}`, '/dashboard')
    penalised++
  }

  return { locks: locks?.length ?? 0, reminded, penalised }
})
