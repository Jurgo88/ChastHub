import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAdminLevel, requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const { adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['super_admin'])

  const supabase = useSupabaseAdmin()

  const { data: admins, error } = await supabase
    .from('profiles')
    .select('id, email, admin_level, created_at')
    .eq('is_admin', true)
    .order('created_at', { ascending: false })

  if (error) throw createError({ statusCode: 500, message: 'Failed to fetch admins' })

  return { admins: admins ?? [] }
})
