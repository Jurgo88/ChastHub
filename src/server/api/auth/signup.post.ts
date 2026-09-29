import { createClient } from '@supabase/supabase-js'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { generateUniqueDisplayName } from '~/server/utils/displayName'
import { getClientIp } from '~/server/utils/clientIp'
import { readSignupOrigin } from '~/server/utils/signupOrigin'
import { sanitizeSignupSource, signupSourceColumns } from '~/server/utils/signupSource'
import type { UserRole } from '~/types'

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter'
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter'
  if (!/[0-9]/.test(password)) return 'Password must contain a number'
  return null
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  if (!config.public.signupsEnabled) {
    throw createError({ statusCode: 403, message: 'Signups are not open yet' })
  }

  const ip = getClientIp(event) ?? 'unknown' // TASK-144

  if (!await checkRateLimit(`signup:${ip}`, 10, 60 * 60 * 1000)) {
    throw createError({ statusCode: 429, message: 'Too many signup attempts. Try again later.' })
  }

  const body = await readBody<{ email: string; password: string; role: UserRole; termsAccepted: boolean; source?: unknown }>(event)
  const { email, password, role, termsAccepted } = body ?? {}

  if (!email || !password || !role) {
    throw createError({ statusCode: 400, message: 'Email, password, and role are required' })
  }

  if (!['loqee', 'loqholder'].includes(role)) {
    throw createError({ statusCode: 400, message: 'Role must be wearer or keyholder' })
  }

  if (termsAccepted !== true) {
    throw createError({ statusCode: 400, message: 'You must confirm you are 18+ and agree to the Terms of Service and Privacy Policy' })
  }

  const passwordError = validatePassword(password)
  if (passwordError) {
    throw createError({ statusCode: 400, message: passwordError })
  }

  const supabase = useSupabaseAdmin()

  // TASK-123 — this used to be an unconditional `email_confirm: true`, which
  // marks the address verified server-side and stops Supabase from ever
  // sending a confirmation mail. Anyone could sign up with an address they
  // did not own — and that address is what password recovery and every
  // notification depend on.
  const requireConfirmation = config.public.requireEmailConfirmation === true

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: !requireConfirmation,
  })

  if (authError) {
    const isDuplicate = authError.message.toLowerCase().includes('already')
      || authError.message.toLowerCase().includes('duplicate')
    throw createError({
      statusCode: isDuplicate ? 409 : 500,
      message: isDuplicate ? 'Email already in use' : 'Failed to create account',
    })
  }

  // TASK-124 — without this the profile is created with display_name NULL
  // and every surface falls back to the user's email address.
  const displayName = await generateUniqueDisplayName(supabase, role)

  // TASK-137 — read before the write, but never allowed to block it: every
  // field is nullable and the helper swallows its own failures.
  const origin = readSignupOrigin(event)
  // TASK-164 — where they came from, as the client saw it. Sanitised, never
  // able to fail the signup.
  const source = sanitizeSignupSource(body?.source, getRequestHost(event))

  // Create profile — retry once on failure
  let profileError: unknown = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabase.from('profiles').upsert({
      id: authData.user.id,
      email,
      role,
      display_name: displayName,
      terms_accepted_at: new Date().toISOString(),
      signup_country: origin.country,
      signup_region: origin.region,
      signup_timezone: origin.timezone,
      signup_locale: origin.locale,
      ...signupSourceColumns(source),
    }, { onConflict: 'id' })
    if (!error) { profileError = null; break }
    profileError = error
  }

  if (profileError) {
    await supabase.auth.admin.deleteUser(authData.user.id)
    console.error('[signup] Profile creation failed:', profileError)
    throw createError({ statusCode: 500, message: 'Failed to create profile. Please try again.' })
  }

  // The admin API does not send mail, so ask Supabase to send the signup
  // confirmation for this (still unconfirmed) user. A failure here is not
  // fatal — the account exists and /api/auth/resend-confirmation can retry.
  let confirmationSent = false
  if (requireConfirmation) {
    const anon = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error: sendError } = await anon.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${config.public.siteUrl}/auth/callback` },
    })
    if (sendError) console.error('[signup] Failed to send confirmation mail:', sendError.message)
    else confirmationSent = true
  }

  return {
    userId: authData.user.id,
    confirmationRequired: requireConfirmation,
    confirmationSent,
  }
})
