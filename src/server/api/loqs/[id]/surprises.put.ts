import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { isValidTimeZone } from '~/server/utils/checkin'
import { MAX_SURPRISE_MESSAGE, parseClock, planSurprises, type SurpriseSettings } from '~/server/utils/surprises'

// PUT /api/loqs/<id>/surprises: the keyholder sets how often and how big the
// surprises are. Saving throws away the old plan and plans a fresh week.
export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqholder') throw createError({ statusCode: 403, message: 'Only keyholders can set surprises' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const b = await readBody<Record<string, unknown>>(event) ?? {}
  const int = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null)

  const perWeek = int(b.per_week, 1, 14)
  const minMinutes = int(b.min_minutes, 1, 10080)
  const maxMinutes = int(b.max_minutes, 1, 10080)
  if (perWeek === null) throw createError({ statusCode: 400, message: 'per_week must be 1 to 14' })
  if (minMinutes === null || maxMinutes === null || minMinutes > maxMinutes) {
    throw createError({ statusCode: 400, message: 'Invalid time range' })
  }
  if (typeof b.allow_remove !== 'boolean') throw createError({ statusCode: 400, message: 'allow_remove must be true or false' })

  const start = parseClock(b.window_start)
  const end = parseClock(b.window_end)
  if (start === null || end === null || end <= start) throw createError({ statusCode: 400, message: 'Invalid time window' })

  const message = typeof b.message === 'string' ? b.message.trim() : ''
  if (message.length > MAX_SURPRISE_MESSAGE) {
    throw createError({ statusCode: 400, message: `Message too long (max ${MAX_SURPRISE_MESSAGE} characters)` })
  }

  const supabase = useSupabaseAdmin()
  const { data: loq } = await supabase
    .from('loqs')
    .select('id, loqholder_id, status, checkin_tz')
    .eq('id', id)
    .maybeSingle()
  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  if (loq.loqholder_id !== user.id) throw createError({ statusCode: 403, message: 'Not your lock' })
  if (!['active', 'paused'].includes(loq.status)) throw createError({ statusCode: 409, message: 'Lock is not running' })

  // The window is the wearer's own clock; their zone is known once they have
  // checked in, otherwise the keyholder's zone is the best guess.
  const tz = loq.checkin_tz ?? (isValidTimeZone(b.tz) ? b.tz : null)
  if (!tz) throw createError({ statusCode: 400, message: 'A valid time zone is required' })

  const settings: SurpriseSettings = {
    per_week: perWeek, min_minutes: minMinutes, max_minutes: maxMinutes, allow_remove: b.allow_remove,
    window_start: b.window_start as string, window_end: b.window_end as string, tz, message: message || null,
  }

  const { error } = await supabase.from('loq_surprise_settings').upsert({ loq_id: id, ...settings }, { onConflict: 'loq_id' })
  if (error) throw createError({ statusCode: 500, message: 'Failed to save settings' })

  const now = new Date().toISOString()
  await supabase.from('loq_surprises').update({ cancelled_at: now }).eq('loq_id', id).is('executed_at', null).is('cancelled_at', null)

  const plan = planSurprises(settings, Date.now())
  if (plan.length) await supabase.from('loq_surprises').insert(plan.map(p => ({ loq_id: id, ...p })))

  return { settings, planned: plan.length }
})
