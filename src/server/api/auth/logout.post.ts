import { clearSessionCookie } from '~/server/utils/sessionCookie'

export default defineEventHandler(async (event) => {
  // Session invalidation is handled client-side via supabase.auth.signOut().
  // This endpoint clears the httpOnly refresh-token cookie (TASK-082).
  clearSessionCookie(event)
  return { success: true }
})
