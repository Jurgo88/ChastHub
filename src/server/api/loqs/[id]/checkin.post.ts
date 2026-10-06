import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { sendPushNotification } from '~/server/utils/sendPushNotification'
import {
  checkinMessage, computeStreak, isMood, isValidTimeZone, localParts, MAX_NOTE_LENGTH, MOOD_EMOJI, pausedDays,
} from '~/server/utils/checkin'

// POST /api/loqs/<id>/checkin { mood, note?, tz }: the wearer's once-a-day mood
// tap. "Day" is the wearer's own calendar day in `tz`.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  if (!await checkRateLimit(`checkin:${user.id}`, 10, 60_000)) {
    throw createError({ statusCode: 429, message: 'Too many attempts. Slow down.' })
  }

  const body = await readBody<{ mood?: unknown; note?: unknown; tz?: unknown }>(event)
  if (!isMood(body?.mood)) throw createError({ statusCode: 400, message: 'Pick a mood' })
  if (!isValidTimeZone(body?.tz)) throw createError({ statusCode: 400, message: 'Invalid time zone' })
  const note = typeof body.note === 'string' ? body.note.trim() : ''
  if (note.length > MAX_NOTE_LENGTH) {
    throw createError({ statusCode: 400, message: `Note too long (max ${MAX_NOTE_LENGTH} characters)` })
  }

  const supabase = useSupabaseAdmin()
  const { data: loq } = await supabase
    .from('loqs')
    .select('id, loqee_id, loqholder_id, status, paused_at')
    .eq('id', id)
    .maybeSingle()

  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  if (loq.loqee_id !== user.id) throw createError({ statusCode: 403, message: 'Only the wearer can check in' })
  if (!['active', 'paused'].includes(loq.status)) throw createError({ statusCode: 409, message: 'Lock is not running' })

  const tz = body.tz
  const today = localParts(Date.now(), tz).date

  const { error } = await supabase
    .from('loq_checkins')
    .insert({ loq_id: id, mood: body.mood, note: note || null, local_date: today })
  if (error) {
    if (error.code === '23505') throw createError({ statusCode: 409, message: 'Already checked in today' })
    throw createError({ statusCode: 500, message: 'Failed to save check-in' })
  }

  // The cron needs the wearer's zone to know when their day starts and ends.
  await supabase.from('loqs').update({ checkin_tz: tz }).eq('id', id)

  const [{ data: days }, { data: pauses }] = await Promise.all([
    supabase.from('loq_checkins').select('local_date').eq('loq_id', id).order('local_date', { ascending: false }).limit(4000),
    supabase.from('audit_log').select('action, created_at').eq('details->>loq_id', id).in('action', ['loq_paused', 'loq_resumed']).order('created_at', { ascending: true }),
  ])
  const streak = computeStreak(
    (days ?? []).map(d => d.local_date as string),
    today,
    pausedDays((pauses ?? []).map(p => ({ type: p.action === 'loq_paused' ? 'paused' : 'resumed', at: p.created_at as string })), loq.paused_at, tz),
  )

  if (loq.loqholder_id) {
    await supabase.from('messages').insert({
      loq_id: id,
      sender_id: user.id,
      content: checkinMessage(body.mood, note || null),
      loqee_id: loq.loqee_id,
      loqholder_id: loq.loqholder_id,
    })
    await sendPushNotification(loq.loqholder_id, `${MOOD_EMOJI[body.mood]} Daily check-in`, note ? note.slice(0, 80) : `Feeling ${body.mood}`, '/dashboard')
  }

  return { mood: body.mood, note: note || null, local_date: today, streak }
})
