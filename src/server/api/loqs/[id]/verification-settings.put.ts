import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { isValidTimeZone } from '~/server/utils/checkin'
import { isHHMM, MAX_PENALTY_MINUTES, nextAutoTime, toMinutes } from '~/server/utils/verification'
import { loadVerificationLock } from '~/server/utils/verificationDb'

// PUT /api/loqs/<id>/verification-settings { random_daily, window_start,
// window_end, tz, due_minutes, penalty_minutes }: the random daily
// verification. The keyholder sets it; on a self-lock the wearer does.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const b = await readBody<Record<string, unknown>>(event)
  if (typeof b?.random_daily !== 'boolean') throw createError({ statusCode: 400, message: 'random_daily must be true or false' })
  if (!isHHMM(b.window_start) || !isHHMM(b.window_end) || toMinutes(b.window_start) >= toMinutes(b.window_end)) {
    throw createError({ statusCode: 400, message: 'The window must start before it ends (HH:MM)' })
  }
  if (!isValidTimeZone(b.tz)) throw createError({ statusCode: 400, message: 'Invalid time zone' })
  if (typeof b.due_minutes !== 'number' || !Number.isInteger(b.due_minutes) || b.due_minutes < 15 || b.due_minutes > 1440) {
    throw createError({ statusCode: 400, message: 'due_minutes must be from 15 to 1440' })
  }
  const penalty = b.penalty_minutes === undefined ? 0 : b.penalty_minutes
  if (typeof penalty !== 'number' || !Number.isInteger(penalty) || penalty < 0 || penalty > MAX_PENALTY_MINUTES) {
    throw createError({ statusCode: 400, message: `penalty_minutes must be a whole number from 0 to ${MAX_PENALTY_MINUTES}` })
  }

  const supabase = useSupabaseAdmin()
  const { loq, isKeyholder, isSelfLock, isWearer } = await loadVerificationLock(supabase, id, user.id)
  if (!isKeyholder && !(isSelfLock && isWearer)) throw createError({ statusCode: 403, message: 'Only the keyholder can change this' })
  if (!['active', 'paused'].includes(loq.status)) throw createError({ statusCode: 409, message: 'Lock is not running' })

  const row = {
    loq_id: id,
    random_daily: b.random_daily,
    window_start: b.window_start,
    window_end: b.window_end,
    tz: b.tz,
    due_minutes: b.due_minutes,
    penalty_minutes: penalty,
    // The cron picks the first random time; a changed window must re-roll it.
    next_auto_at: b.random_daily ? nextAutoTime(Date.now(), b.window_start, b.window_end, b.tz, Math.random) : null,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('loq_verification_settings').upsert(row, { onConflict: 'loq_id' })
  if (error) throw createError({ statusCode: 500, message: 'Failed to save settings' })

  const { next_auto_at: _omit, loq_id: _id, updated_at: _at, ...settings } = row
  return settings
})
