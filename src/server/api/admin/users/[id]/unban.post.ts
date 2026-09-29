import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAdminLevel, requireAuth } from '~/server/utils/auth'
import { logAudit } from '~/server/utils/auditLog'

export default defineEventHandler(async (event) => {
  const { user: adminUser, adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['support', 'super_admin'])

  const targetId = getRouterParam(event, 'id')
  if (!targetId) throw createError({ statusCode: 400, message: 'User ID required' })

  const supabase = useSupabaseAdmin()

  const { data: target } = await supabase
    .from('profiles')
    .select('id, status')
    .eq('id', targetId)
    .maybeSingle()

  if (!target) throw createError({ statusCode: 404, message: 'User not found' })
  if (target.status !== 'banned') throw createError({ statusCode: 409, message: 'User is not banned' })

  const { error } = await supabase
    .from('profiles')
    .update({ status: 'active' })
    .eq('id', targetId)

  if (error) throw createError({ statusCode: 500, message: 'Failed to unban user' })

  await logAudit(supabase, 'user_unbanned', adminUser.id, targetId)

  return { success: true }
})
