import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Conversation ID required' })

  const supabase = useSupabaseAdmin()

  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, user_a_id, user_b_id, status, requested_by')
    .eq('id', id)
    .maybeSingle()

  if (!conversation) throw createError({ statusCode: 404, message: 'Conversation not found' })
  if (conversation.user_a_id !== user.id && conversation.user_b_id !== user.id) {
    throw createError({ statusCode: 403, message: 'Not a participant in this conversation' })
  }
  if (conversation.requested_by === user.id) {
    throw createError({ statusCode: 403, message: "You can't decline your own request" })
  }
  if (conversation.status !== 'pending') {
    throw createError({ statusCode: 409, message: 'Conversation is not pending' })
  }

  const { data: updated, error } = await supabase
    .from('conversations')
    .update({ status: 'declined', responded_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .single()

  if (error || !updated) throw createError({ statusCode: 500, message: 'Failed to decline conversation' })

  return updated
})
