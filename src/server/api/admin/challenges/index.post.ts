import { requireAdminLevel, requireAuth } from '~/server/utils/auth'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { logAudit } from '~/server/utils/auditLog'
import { SLUG_PATTERN } from '~/utils/challenges'

// POST /api/admin/challenges: create a challenge, either a fixed period
// (starts_at + ends_at) or a length from joining (duration_minutes).
export default defineEventHandler(async (event) => {
  const { user, adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['support', 'super_admin'])

  const b = await readBody<Record<string, unknown>>(event) ?? {}
  const bad = (message: string) => createError({ statusCode: 400, message })

  const slug = typeof b.slug === 'string' ? b.slug.trim() : ''
  if (!SLUG_PATTERN.test(slug) || slug.length > 60) throw bad('The slug may only have lowercase letters, numbers and dashes.')

  const title = typeof b.title === 'string' ? b.title.trim() : ''
  if (title.length < 2 || title.length > 80) throw bad('The title needs 2 to 80 characters.')

  const description = typeof b.description === 'string' ? b.description.trim() : ''
  if (description.length > 500) throw bad('The description can have at most 500 characters.')

  const maxPause = b.max_pause_minutes === undefined ? 1440 : b.max_pause_minutes
  if (typeof maxPause !== 'number' || !Number.isInteger(maxPause) || maxPause < 0 || maxPause > 10080) {
    throw bad('max_pause_minutes must be 0 to 10080.')
  }

  const row: Record<string, unknown> = { slug, title, description: description || null, max_pause_minutes: maxPause, created_by: user.id }

  if (b.starts_at || b.ends_at) {
    const starts = typeof b.starts_at === 'string' ? Date.parse(b.starts_at) : NaN
    const ends = typeof b.ends_at === 'string' ? Date.parse(b.ends_at) : NaN
    if (Number.isNaN(starts) || Number.isNaN(ends) || ends <= starts) throw bad('The end must be after the start.')
    row.starts_at = new Date(starts).toISOString()
    row.ends_at = new Date(ends).toISOString()
  }
  else {
    const d = b.duration_minutes
    if (typeof d !== 'number' || !Number.isInteger(d) || d < 60 || d > 525600) throw bad('Give either a start and an end, or a length of 60 to 525600 minutes.')
    row.duration_minutes = d
  }

  const supabase = useSupabaseAdmin()
  const { data, error } = await supabase.from('challenges').insert(row).select('id, slug').single()
  if (error) {
    if (error.code === '23505') throw createError({ statusCode: 409, message: 'A challenge with this slug already exists.' })
    throw createError({ statusCode: 500, message: 'Could not create the challenge' })
  }

  await logAudit(supabase, 'challenge_created', user.id, user.id, { challenge_id: data.id, slug })
  return data
})
