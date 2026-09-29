import { setSessionCookie } from '~/server/utils/sessionCookie'

// TASK-082 — client calls this whenever it establishes/refreshes a Supabase
// session (see plugins/auth.ts onAuthStateChange), to mirror the refresh
// token into an httpOnly cookie. Possessing a valid refresh_token already
// implies full account access, so no additional auth check is meaningful
// here — this endpoint only persists what the caller already legitimately
// holds.
export default defineEventHandler(async (event) => {
  const body = await readBody<{ refresh_token?: string }>(event)
  const refreshToken = body?.refresh_token
  if (!refreshToken) throw createError({ statusCode: 400, message: 'refresh_token is required' })

  setSessionCookie(event, refreshToken)
  return { success: true }
})
