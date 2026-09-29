import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAdminLevel, requireAuth } from '~/server/utils/auth'
import { logAudit } from '~/server/utils/auditLog'

export default defineEventHandler(async (event) => {
  const { user: adminUser, adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['super_admin'])

  const targetId = getRouterParam(event, 'id')
  if (!targetId) throw createError({ statusCode: 400, message: 'User ID required' })

  const supabase = useSupabaseAdmin()

  const { data: target } = await supabase
    .from('profiles')
    .select('id, is_admin, admin_level')
    .eq('id', targetId)
    .maybeSingle<{ id: string; is_admin: boolean; admin_level: string | null }>()

  if (!target || !target.is_admin) throw createError({ statusCode: 404, message: 'Admin not found' })

  if (target.admin_level === 'super_admin') {
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_admin', true)
      .eq('admin_level', 'super_admin')

    if ((count ?? 0) <= 1) {
      throw createError({ statusCode: 409, message: 'Cannot demote the last remaining super admin' })
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ is_admin: false, admin_level: null })
    .eq('id', targetId)

  if (error) throw createError({ statusCode: 500, message: 'Failed to demote admin' })

  await logAudit(supabase, 'admin_demoted', adminUser.id, targetId)

  return { success: true }
})
