import { createClient } from '@supabase/supabase-js'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { setSessionCookie } from '~/server/utils/sessionCookie'
import { getClientIp } from '~/server/utils/clientIp'

export default defineEventHandler(async (event) => {
  // TASK-144 — was getRequestIP, which is undefined on Netlify: this
  // limit was global, so five failed logins from anyone would have locked
  // every user out of logging in for fifteen minutes.
  const ip = getClientIp(event) ?? 'unknown'

  if (!await checkRateLimit(`login:${ip}`, 5, 15 * 60 * 1000)) {
    throw createError({ statusCode: 429, message: 'Too many login attempts. Try again in 15 minutes.' })
  }

  const body = await readBody<{ email: string; password: string }>(event)
  const { email, password } = body ?? {}

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email and password are required' })
  }

  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  // TASK-123 — an unconfirmed address is a distinct, fixable situation, and
  // reporting it as "Invalid email or password" sends people to the password
  // reset flow for no reason. Safe to disclose: the caller just proved they
  // know this account's password.
  if (error && (error.code === 'email_not_confirmed' || /not confirmed/i.test(error.message))) {
    throw createError({
      statusCode: 403,
      message: 'Confirm your email address first — check your inbox for the link we sent.',
      data: { code: 'email_not_confirmed' },
    })
  }

  if (error || !data.session) {
    throw createError({ statusCode: 401, message: 'Invalid email or password' })
  }

  // Check ban status using service key to bypass RLS
  const admin = useSupabaseAdmin()
  const { data: profile } = await admin
    .from('profiles')
    .select('status')
    .eq('id', data.user.id)
    .single<{ status: string }>()

  if (profile?.status === 'deleted') {
    throw createError({ statusCode: 403, message: 'This account was deleted' })
  }

  if (profile?.status === 'banned') {
    throw createError({ statusCode: 403, message: 'Account suspended' })
  }

  // TASK-082 — set the httpOnly recovery cookie now rather than waiting for
  // the client's setSession() call to round-trip through /api/auth/session-cookie.
  setSessionCookie(event, data.session.refresh_token)

  return { session: data.session, user: data.user }
})
