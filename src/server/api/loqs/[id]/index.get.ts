import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { maybeExpireLoq } from '~/server/utils/expireLoq'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const supabase = useSupabaseAdmin()

  const { data: loq, error } = await supabase
    .from('loqs')
    .select(`
      *,
      loqee:profiles!loqee_id(id, display_name, avatar_url),
      loqholder:profiles!loqholder_id(id, display_name, avatar_url)
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, message: 'Failed to fetch lock' })
  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })

  if (loq.loqee_id !== user.id && loq.loqholder_id !== user.id) {
    throw createError({ statusCode: 403, message: 'Access denied' })
  }

  if (await maybeExpireLoq(supabase, loq)) {
    throw createError({ statusCode: 410, message: 'This lock has ended' })
  }

  const { count: pendingRequests } = await supabase
    .from('loq_requests')
    .select('id', { count: 'exact', head: true })
    .eq('loq_id', id)
    .eq('status', 'pending')

  return { ...loq, pending_requests: pendingRequests ?? 0 }
})
