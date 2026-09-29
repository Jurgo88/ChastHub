import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAdminLevel, requireAuth } from '~/server/utils/auth'

const VALID_STATUSES = ['draft', 'pending', 'active', 'paused', 'ended', 'cancelled']

export default defineEventHandler(async (event) => {
  const { adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['support', 'super_admin'])

  const supabase = useSupabaseAdmin()
  const query = getQuery(event)
  const status = query.status as string | undefined
  const self = query.self === 'true'
  const limit = Math.min(Number(query.limit) || 50, 100)
  const offset = Number(query.offset) || 0

  let q = supabase
    .from('loqs')
    .select(`
      id, status, accepted_at, paused_at, ended_at, created_at, loqed_until, loqholder_id,
      loqee:profiles!loqee_id(id, email, display_name),
      loqholder:profiles!loqholder_id(id, email, display_name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && VALID_STATUSES.includes(status)) {
    q = q.eq('status', status)
  }
  if (self) {
    q = q.is('loqholder_id', null)
  }

  const { data: loqs, count, error } = await q

  if (error) throw createError({ statusCode: 500, message: 'Failed to fetch locks' })

  return { loqs, total: count ?? 0 }
})
