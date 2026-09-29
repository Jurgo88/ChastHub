import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

// Marks the thread as read up to now for the caller.
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

  const now = new Date().toISOString()
  const column = conversation.user_a_id === user.id ? 'user_a_last_read_at' : 'user_b_last_read_at'
  const { error } = await supabase.from('conversations').update({ [column]: now }).eq('id', id)
  if (error) throw createError({ statusCode: 500, message: 'Failed to mark as read' })

  return { last_read_at: now }
})
