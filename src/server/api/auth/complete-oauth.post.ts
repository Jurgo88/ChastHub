import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { generateUniqueDisplayName } from '~/server/utils/displayName'
import { readSignupOrigin } from '~/server/utils/signupOrigin'
import { sanitizeSignupSource, signupSourceColumns } from '~/server/utils/signupSource'
import type { UserRole } from '~/types'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  if (!config.public.signupsEnabled) {
    throw createError({ statusCode: 403, message: 'Signups are not open yet' })
  }

  const authHeader = getRequestHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const body = await readBody<{ role: UserRole; termsAccepted: boolean; source?: unknown }>(event)
  const { role, termsAccepted } = body ?? {}

  if (!role || !['loqee', 'loqholder'].includes(role)) {
    throw createError({ statusCode: 400, message: 'Valid role is required' })
  }

  if (termsAccepted !== true) {
    throw createError({ statusCode: 400, message: 'You must confirm you are 18+ and agree to the Terms of Service and Privacy Policy' })
  }

  const supabase = useSupabaseAdmin()

  const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.slice(7))
  if (userError || !user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (existing) {
    throw createError({ statusCode: 409, message: 'Profile already exists' })
  }

  // TASK-124 — deliberately NOT user_metadata.full_name from Google: that is
  // the user's real name, and display_name is published on public profiles
  // and the leaderboard. They can set it to their real name themselves if
  // that is what they want.
  const displayName = await generateUniqueDisplayName(supabase)

  // TASK-137 — `locale` is Google's own account setting, which lands in
  // user_metadata and was otherwise thrown away. It beats Accept-Language,
  // which only says what browser happens to be open.
  const origin = readSignupOrigin(event, user.user_metadata?.locale as string | undefined)
  // TASK-164 — carried through the OAuth return URL by the signup page.
  const source = sanitizeSignupSource(body?.source, getRequestHost(event))

  const { error: profileError } = await supabase.from('profiles').insert({
    id: user.id,
    email: user.email!,
    role,
    display_name: displayName,
    terms_accepted_at: new Date().toISOString(),
    signup_country: origin.country,
    signup_region: origin.region,
    signup_timezone: origin.timezone,
    signup_locale: origin.locale,
    ...signupSourceColumns(source),
  })

  if (profileError) {
    console.error('[complete-oauth] Profile creation failed:', profileError)
    throw createError({ statusCode: 500, message: 'Failed to create profile. Please try again.' })
  }

  return { userId: user.id }
})
