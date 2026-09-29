import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAdminLevel, requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const { adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['support', 'super_admin'])

  const supabase = useSupabaseAdmin()
  const query = getQuery(event)
  const status = query.status as string | undefined
  const limit = Math.min(Number(query.limit) || 50, 100)
  const offset = Number(query.offset) || 0

  let q = supabase
    .from('reports')
    .select(`
      id, reason, description, status, created_at, resolved_at, conversation_id,
      lounge_message:lounge_messages!lounge_message_id(id, content, created_at),
      reported_user:profiles!reported_user_id(id, email, display_name),
      reported_by:profiles!reported_by_id(id, email, display_name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && ['open', 'dismissed', 'resolved'].includes(status)) {
    q = q.eq('status', status)
  }

  const { data: reports, count, error } = await q

  if (error) throw createError({ statusCode: 500, message: 'Failed to fetch reports' })

  return { reports, total: count ?? 0 }
})
