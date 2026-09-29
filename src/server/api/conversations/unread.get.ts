import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

// Conversations with something new (unread messages or an incoming request).
// Polled by the nav badge.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const { data, error } = await useSupabaseAdmin().rpc('dm_unread_total', { p_user: user.id })
  if (error) throw createError({ statusCode: 500, message: 'Failed to count unread messages' })
  return { count: (data as number | null) ?? 0 }
})
