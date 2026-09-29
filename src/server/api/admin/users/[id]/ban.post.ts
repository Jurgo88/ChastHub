import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAdminLevel, requireAuth } from '~/server/utils/auth'
import { banUser } from '~/server/utils/banUser'

export default defineEventHandler(async (event) => {
  const { user: adminUser, adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['support', 'super_admin'])

  const targetId = getRouterParam(event, 'id')
  if (!targetId) throw createError({ statusCode: 400, message: 'User ID required' })

  if (targetId === adminUser.id) {
    throw createError({ statusCode: 400, message: 'Cannot ban yourself' })
  }

  const body = await readBody<{ reason?: string }>(event)
  const supabase = useSupabaseAdmin()

  // Verify target exists and is not already banned
  const { data: target } = await supabase
    .from('profiles')
    .select('id, status, is_admin')
    .eq('id', targetId)
    .maybeSingle<{ id: string; status: string; is_admin: boolean }>()

  if (!target) throw createError({ statusCode: 404, message: 'User not found' })
  if (target.status === 'banned') throw createError({ statusCode: 409, message: 'User is already banned' })
  if (target.is_admin) throw createError({ statusCode: 403, message: 'Cannot ban another admin' })

  await banUser(supabase, adminUser.id, targetId, { reason: body?.reason ?? null })

  return { success: true }
})
