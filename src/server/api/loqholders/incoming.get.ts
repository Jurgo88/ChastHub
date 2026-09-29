import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqholder') throw createError({ statusCode: 403, message: 'Only keyholders can view incoming requests' })

  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 20, 100)
  const offset = Number(query.offset) || 0

  const supabase = useSupabaseAdmin()

  // TASK-102 — loq_requests rows look identical regardless of who
  // initiated them (loqee-initiated private request vs this loqholder's
  // own outgoing request-to-join on a public loq, TASK-087). Without the
  // is_public filter, a loqholder would see their own pending
  // request-to-join listed here as if it were something *for them* to
  // accept/reject — clicking "Accept" on it would just 409
  // (accept.post.ts already refuses public loqs on this path).
  const { data, count, error } = await supabase
    .from('loq_requests')
    .select(`
      id,
      status,
      created_at,
      loq:loqs!inner(
        id,
        duration_minutes,
        emotion,
        reason,
        is_public,
        created_at,
        loqed_until,
        loqee:profiles!loqee_id(id, display_name, avatar_url)
      )
    `, { count: 'exact' })
    .eq('loqholder_id', user.id)
    .eq('status', 'pending')
    .eq('loq.is_public', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw createError({ statusCode: 500, message: 'Failed to fetch incoming requests' })

  return { data, total: count ?? 0 }
})
