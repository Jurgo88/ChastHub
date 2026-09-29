import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const { password } = await readBody<{ password: string }>(event)

  if (!password || password.length < 8) {
    throw createError({ statusCode: 400, message: 'Password must be at least 8 characters' })
  }

  const supabase = useSupabaseAdmin()
  const { error } = await supabase.auth.admin.updateUserById(user.id, { password })

  if (error) throw createError({ statusCode: 500, message: 'Failed to update password' })

  return { ok: true }
})
