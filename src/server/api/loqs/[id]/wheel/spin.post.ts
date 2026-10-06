import { randomInt } from 'node:crypto'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { logAudit } from '~/server/utils/auditLog'
import { sendPushNotification } from '~/server/utils/sendPushNotification'
import { loadWheelLock } from '~/server/utils/wheelAccess'
import { MAX_DURATION_MINUTES } from '~/server/utils/loqValidation'
import { applySegment, pickSegment, segmentLabel, validateSegments } from '~/utils/wheel'

// POST /api/loqs/<id>/wheel/spin: the wearer spins. The server draws the
// segment, applies it and answers with the result; the client only animates to
// it. One spin per interval: the spin is claimed by moving next_spin_at in a
// single UPDATE that only matches when it is due, so two quick taps (or a
// forged client) cannot both get through.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const supabase = useSupabaseAdmin()
  const { loq, role } = await loadWheelLock(supabase, id, user.id)
  if (role !== 'wearer') throw createError({ statusCode: 403, message: 'Only the wearer can spin the wheel' })
  if (loq.status !== 'active') throw createError({ statusCode: 409, message: 'The wheel can only be spun while the lock is running' })
  if (!loq.loqed_until) throw createError({ statusCode: 409, message: 'Lock has no timer set' })

  const { data: wheel } = await supabase
    .from('loq_wheels')
    .select('enabled, segments, interval_minutes, next_spin_at')
    .eq('loq_id', id)
    .maybeSingle()
  if (!wheel?.enabled) throw createError({ statusCode: 404, message: 'There is no wheel on this lock' })

  const parsed = validateSegments(wheel.segments)
  if (!parsed.ok) throw createError({ statusCode: 500, message: 'The wheel is misconfigured' })

  const now = Date.now()
  const nextAt = new Date(now + wheel.interval_minutes * 60_000).toISOString()
  const claim = supabase
    .from('loq_wheels')
    .update({ next_spin_at: nextAt, locked_config: !loq.loqholder_id ? true : undefined })
    .eq('loq_id', id)
  const { data: claimed } = await (wheel.next_spin_at
    ? claim.lte('next_spin_at', new Date(now).toISOString())
    : claim.is('next_spin_at', null)
  ).select('loq_id')

  if (!claimed?.length) {
    throw createError({
      statusCode: 429,
      message: 'You can not spin yet',
      data: { next_spin_at: wheel.next_spin_at },
    })
  }

  const index = pickSegment(parsed.segments, () => randomInt(0, 1_000_000) / 1_000_000)
  const segment = parsed.segments[index]!
  const effect = applySegment(
    segment,
    new Date(loq.loqed_until).getTime(),
    now,
    MAX_DURATION_MINUTES,
    loq.frozen_until ? new Date(loq.frozen_until).getTime() : null,
  )

  if (effect.applied) {
    const { error } = await supabase
      .from('loqs')
      .update({
        loqed_until: new Date(effect.loqedUntil).toISOString(),
        ...(effect.frozenUntil ? { frozen_until: new Date(effect.frozenUntil).toISOString() } : {}),
      })
      .eq('id', id)
    if (error) {
      // Give the spin back so the wearer is not charged for our failure.
      await supabase.from('loq_wheels').update({ next_spin_at: wheel.next_spin_at }).eq('loq_id', id)
      throw createError({ statusCode: 500, message: 'Failed to apply the spin' })
    }
  }

  await supabase.from('loq_wheel_spins').insert({
    loq_id: id,
    spun_by: user.id,
    segment_index: index,
    segment,
    applied: effect.applied,
    delta_minutes: effect.deltaMinutes,
  })

  await logAudit(supabase, 'loq_wheel_spin', user.id, loq.loqee_id, {
    loq_id: id,
    segment_type: segment.type,
    delta_minutes: effect.deltaMinutes,
    label: segmentLabel(segment),
    applied: effect.applied,
  })

  const label = segmentLabel(segment)
  if (loq.loqholder_id) {
    await supabase.from('messages').insert({
      loq_id: id,
      sender_id: user.id,
      content: `🎡 Spun the wheel: ${label}`,
      loqee_id: loq.loqee_id,
      loqholder_id: loq.loqholder_id,
    })
    await sendPushNotification(loq.loqholder_id, '🎡 Wheel spun', `Your wearer spun: ${label}`, '/dashboard')
  }

  return {
    segment_index: index,
    segment,
    applied: effect.applied,
    delta_minutes: effect.deltaMinutes,
    note: effect.note,
    loqed_until: new Date(effect.loqedUntil).toISOString(),
    frozen_until: effect.frozenUntil ? new Date(effect.frozenUntil).toISOString() : null,
    next_spin_at: nextAt,
  }
})
