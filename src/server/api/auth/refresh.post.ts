import { createClient } from '@supabase/supabase-js'
import { clearSessionCookie, getSessionCookie, setSessionCookie } from '~/server/utils/sessionCookie'

// TASK-082 — session recovery fallback for when localStorage was wiped or
// never persisted (in-app browsers, Private Browsing). Called from
// plugins/auth.ts on boot only when the client has no local session.
export default defineEventHandler(async (event) => {
  const refreshToken = getSessionCookie(event)
  if (!refreshToken) return null

  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })

  if (error || !data.session) {
    clearSessionCookie(event)
    return null
  }

  // Supabase rotates the refresh token on every use — persist the new one
  // or the next recovery attempt will fail.
  setSessionCookie(event, data.session.refresh_token)

  return { session: data.session, user: data.user }
})
