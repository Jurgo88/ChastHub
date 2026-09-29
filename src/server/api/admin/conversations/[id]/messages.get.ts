import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAdminLevel, requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const { adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['support', 'super_admin'])

  const conversationId = getRouterParam(event, 'id')
  if (!conversationId) throw createError({ statusCode: 400, message: 'Conversation ID required' })

  const supabase = useSupabaseAdmin()
  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 50, 100)
  const offset = Number(query.offset) || 0

  const { data: conversation } = await supabase
    .from('conversations')
    .select(`
      id, status,
      user_a:profiles!user_a_id(id, email, display_name),
      user_b:profiles!user_b_id(id, email, display_name)
    `)
    .eq('id', conversationId)
    .maybeSingle()

  if (!conversation) throw createError({ statusCode: 404, message: 'Conversation not found' })

  const { data: messages, error } = await supabase
    .from('dm_messages')
    .select('id, content, created_at, sender:profiles!sender_id(id, email, display_name)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw createError({ statusCode: 500, message: 'Failed to fetch messages' })

  return { conversation, messages: messages ?? [] }
})
