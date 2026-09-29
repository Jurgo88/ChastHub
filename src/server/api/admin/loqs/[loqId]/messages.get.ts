import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAdminLevel, requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const { adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['support', 'super_admin'])

  const loqId = getRouterParam(event, 'loqId')
  if (!loqId) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const supabase = useSupabaseAdmin()
  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 50, 100)
  const offset = Number(query.offset) || 0

  const { data: loq } = await supabase
    .from('loqs')
    .select('id')
    .eq('id', loqId)
    .maybeSingle()

  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })

  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, content, created_at, sender:profiles!sender_id(id, email, display_name)')
    .eq('loq_id', loqId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw createError({ statusCode: 500, message: 'Failed to fetch messages' })

  return { messages: messages ?? [] }
})
