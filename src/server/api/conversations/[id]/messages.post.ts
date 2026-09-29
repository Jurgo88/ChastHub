import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { sendPushNotification } from '~/server/utils/sendPushNotification'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)

  if (!await checkRateLimit(`msg:${user.id}`, 20, 60_000)) {
    throw createError({ statusCode: 429, message: 'Too many messages. Slow down.' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Conversation ID required' })

  const body = await readBody<{ content: string }>(event)
  const content = body?.content?.trim() ?? ''

  if (!content) throw createError({ statusCode: 400, message: 'Message cannot be empty' })
  if (content.length > 5000) throw createError({ statusCode: 400, message: 'Message too long (max 5000 characters)' })

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
  if (conversation.status === 'declined') {
    throw createError({ statusCode: 403, message: 'This conversation was declined' })
  }
  if (conversation.status === 'pending' && conversation.requested_by === user.id) {
    throw createError({ statusCode: 409, message: 'Request already sent, waiting for a response' })
  }

  // The recipient replying to a pending request is an implicit accept.
  if (conversation.status === 'pending') {
    await supabase
      .from('conversations')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', id)
  }

  const { data: message, error } = await supabase
    .from('dm_messages')
    .insert({ conversation_id: id, sender_id: user.id, content })
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: 'Failed to send message' })

  const readColumn = conversation.user_a_id === user.id ? 'user_a_last_read_at' : 'user_b_last_read_at'
  await supabase.from('conversations').update({ last_message_at: message.created_at, [readColumn]: message.created_at }).eq('id', id)

  const recipientId = user.id === conversation.user_a_id ? conversation.user_b_id : conversation.user_a_id
  await sendPushNotification(recipientId, 'New message', content.slice(0, 80), `/messages/${id}`)

  return message
})
