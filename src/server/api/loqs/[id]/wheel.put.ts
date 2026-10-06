import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { loadWheelLock } from '~/server/utils/wheelAccess'
import {
  isNotEasier, MAX_INTERVAL_MINUTES, MIN_INTERVAL_MINUTES, validateSegments, type WheelConfig,
} from '~/utils/wheel'

// PUT /api/loqs/<id>/wheel { enabled, segments, interval_minutes }: the
// keyholder sets the wheel (or the wearer on a self-lock). A change applies
// from the next spin. A self-lock wheel that has been spun can only get harder.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const body = await readBody<{ enabled?: unknown; segments?: unknown; interval_minutes?: unknown }>(event) ?? {}
  const parsed = validateSegments(body.segments)
  if (!parsed.ok) throw createError({ statusCode: 400, message: parsed.error })

  const interval = body.interval_minutes
  if (typeof interval !== 'number' || !Number.isInteger(interval) || interval < MIN_INTERVAL_MINUTES || interval > MAX_INTERVAL_MINUTES) {
    throw createError({ statusCode: 400, message: `interval_minutes must be ${MIN_INTERVAL_MINUTES} to ${MAX_INTERVAL_MINUTES}` })
  }
  const enabled = body.enabled === undefined ? true : body.enabled
  if (typeof enabled !== 'boolean') throw createError({ statusCode: 400, message: 'enabled must be true or false' })

  const supabase = useSupabaseAdmin()
  const { loq, role, selfLock } = await loadWheelLock(supabase, id, user.id)
  if (role !== 'keyholder' && !selfLock) throw createError({ statusCode: 403, message: 'Only the keyholder can change the wheel' })
  if (!['active', 'paused'].includes(loq.status)) throw createError({ statusCode: 409, message: 'Lock is not running' })

  const { data: current } = await supabase
    .from('loq_wheels')
    .select('enabled, segments, interval_minutes, locked_config')
    .eq('loq_id', id)
    .maybeSingle()

  if (current?.locked_config && selfLock) {
    const old: WheelConfig = { enabled: current.enabled, segments: current.segments, interval_minutes: current.interval_minutes }
    if (!isNotEasier(old, { enabled, segments: parsed.segments, interval_minutes: interval })) {
      throw createError({ statusCode: 409, message: 'This wheel is locked. You can only add harder segments or spin sooner.' })
    }
  }

  const { error } = await supabase.from('loq_wheels').upsert({
    loq_id: id,
    enabled,
    segments: parsed.segments,
    interval_minutes: interval,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'loq_id' })
  if (error) throw createError({ statusCode: 500, message: 'Failed to save the wheel' })

  return { enabled, segments: parsed.segments, interval_minutes: interval }
})
