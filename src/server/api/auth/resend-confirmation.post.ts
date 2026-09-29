import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { getClientIp } from '~/server/utils/clientIp'

// TASK-123 — resends the signup confirmation mail. Deliberately answers the
// same way whether or not the address exists or is already confirmed: this
// route is unauthenticated, so a truthful answer would turn it into an
// account-existence oracle.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)

  if (!config.public.requireEmailConfirmation) {
    throw createError({ statusCode: 404, message: 'Email confirmation is not enabled' })
  }

  const ip = getClientIp(event) ?? 'unknown' // TASK-144
  if (!await checkRateLimit(`resend-confirm-ip:${ip}`, 5, 60 * 60 * 1000)) {
    throw createError({ statusCode: 429, message: 'Too many requests. Try again later.' })
  }

  const body = await readBody<{ email?: string }>(event)
  const email = body?.email?.trim().toLowerCase()
  if (!email) throw createError({ statusCode: 400, message: 'Email is required' })

  // Per-address limit on top of the per-IP one, so one address can't be
  // mail-bombed from a rotating set of IPs.
  if (!await checkRateLimit(`resend-confirm-email:${email}`, 3, 60 * 60 * 1000)) {
    return { sent: true }
  }

  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${config.public.siteUrl}/auth/callback` },
  })

  if (error) console.error('[resend-confirmation] Supabase refused the resend:', error.message)

  return { sent: true }
})
