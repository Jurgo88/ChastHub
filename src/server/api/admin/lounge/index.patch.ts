import { requireAdminLevel, requireAuth } from '~/server/utils/auth'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { logAudit } from '~/server/utils/auditLog'
import { pingLounge } from '~/server/utils/lounge'
import { isValidSession } from '~/utils/loungeSchedule'

const DATE = /^\d{4}-\d{2}-\d{2}$/

export default defineEventHandler(async (event) => {
  const { user, adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['support', 'super_admin'])

  const body = await readBody<Record<string, unknown>>(event)
  const patch: Record<string, unknown> = {}

  if (body.enabled !== undefined) {
    if (typeof body.enabled !== 'boolean') throw createError({ statusCode: 400, message: 'enabled must be boolean' })
    patch.enabled = body.enabled
  }
  for (const k of ['starts_on', 'ends_on'] as const) {
    if (body[k] !== undefined) {
      if (typeof body[k] !== 'string' || !DATE.test(body[k] as string)) throw createError({ statusCode: 400, message: `${k} must be YYYY-MM-DD` })
      patch[k] = body[k]
    }
  }
  if (body.sessions !== undefined) {
    const list = body.sessions
    if (!Array.isArray(list) || list.length > 6 || !list.every(s => isValidSession(s))) {
      throw createError({ statusCode: 400, message: 'Each session needs a name, a valid time zone and HH:MM times.' })
    }
    patch.sessions = list.map(s => ({ name: s.name.trim(), tz: s.tz, start: s.start, end: s.end }))
  }
  for (const [k, max] of [['slow_mode_seconds', 600], ['min_account_age_hours', 720]] as const) {
    if (body[k] !== undefined) {
      const n = Number(body[k])
      if (!Number.isInteger(n) || n < 0 || n > max) throw createError({ statusCode: 400, message: `${k} must be 0 to ${max}` })
      patch[k] = n
    }
  }
  if (!Object.keys(patch).length) throw createError({ statusCode: 400, message: 'Nothing to change' })

  const supabase = useSupabaseAdmin()
  const { data: current } = await supabase.from('lounge_settings').select('starts_on, ends_on').eq('id', 1).single()
  const startsOn = (patch.starts_on as string | undefined) ?? current?.starts_on
  const endsOn = (patch.ends_on as string | undefined) ?? current?.ends_on
  if (startsOn && endsOn && startsOn > endsOn) {
    throw createError({ statusCode: 400, message: 'The end date is before the start date' })
  }

  const next = { ...patch, updated_at: new Date().toISOString(), updated_by: user.id }
  const { data, error } = await supabase.from('lounge_settings').update(next).eq('id', 1).select('*').single()
  if (error) throw createError({ statusCode: 400, message: 'Could not save' })

  await logAudit(supabase, 'lounge_settings_updated', user.id, user.id, patch)
  await pingLounge({ reload: true })
  return data
})
