import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { checkRateLimit } from '~/server/utils/rateLimit'

const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,19}$/

// Live check while the user types a username. The caller's own current
// username counts as available, so an unchanged field never shows "taken".
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)

  if (!await checkRateLimit(`username-check:${user.id}`, 120, 60 * 1000)) {
    throw createError({ statusCode: 429, message: 'Slow down a little' })
  }

  const username = String(getQuery(event).u ?? '').trim().toLowerCase()
  if (!USERNAME_PATTERN.test(username)) {
    return { available: false, reason: 'invalid' as const }
  }

  const { data } = await useSupabaseAdmin()
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (data && data.id !== user.id) return { available: false, reason: 'taken' as const }
  return { available: true }
})
