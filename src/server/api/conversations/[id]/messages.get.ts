import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Conversation ID required' })

  const supabase = useSupabaseAdmin()

  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, user_a_id, user_b_id')
    .eq('id', id)
    .maybeSingle()

  if (!conversation) throw createError({ statusCode: 404, message: 'Conversation not found' })
  if (conversation.user_a_id !== user.id && conversation.user_b_id !== user.id) {
    throw createError({ statusCode: 403, message: 'Not a participant in this conversation' })
  }

  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 50, 100)
  const offset = Number(query.offset) || 0

  const { data: messages, count, error } = await supabase
    .from('dm_messages')
    .select('*', { count: 'exact' })
    .eq('conversation_id', id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw createError({ statusCode: 500, message: 'Failed to fetch messages' })

  return { messages: (messages ?? []).reverse(), total: count ?? 0, limit, offset }
})
