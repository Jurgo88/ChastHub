import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { sendPushNotification } from '~/server/utils/sendPushNotification'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)

  if (!await checkRateLimit(`msg:${user.id}`, 20, 60_000)) {
    throw createError({ statusCode: 429, message: 'Too many messages. Slow down.' })
  }

  const body = await readBody<{ recipient_id: string; content: string }>(event)
  const recipientId = body?.recipient_id
  const content = body?.content?.trim() ?? ''

  if (!recipientId) throw createError({ statusCode: 400, message: 'recipient_id is required' })
  if (recipientId === user.id) throw createError({ statusCode: 400, message: "You can't message yourself" })
  if (!content) throw createError({ statusCode: 400, message: 'Message cannot be empty' })
  if (content.length > 5000) throw createError({ statusCode: 400, message: 'Message too long (max 5000 characters)' })

  const supabase = useSupabaseAdmin()

  const { data: recipient } = await supabase
    .from('profiles')
    .select('id, status')
    .eq('id', recipientId)
    .maybeSingle()

  if (!recipient || recipient.status === 'banned') {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  const userAId = user.id < recipientId ? user.id : recipientId
  const userBId = user.id < recipientId ? recipientId : user.id

  let { data: conversation } = await supabase
    .from('conversations')
    .select('id, status, requested_by')
    .eq('user_a_id', userAId)
    .eq('user_b_id', userBId)
    .maybeSingle()

  if (!conversation) {
    const { data: created, error } = await supabase
      .from('conversations')
      .insert({ user_a_id: userAId, user_b_id: userBId, requested_by: user.id, status: 'pending' })
      .select('id, status, requested_by')
      .single()

    if (error) throw createError({ statusCode: 500, message: 'Failed to start conversation' })
    conversation = created
  }
  else if (conversation.status === 'declined') {
    throw createError({ statusCode: 403, message: 'This conversation was declined' })
  }
  else if (conversation.status === 'pending' && conversation.requested_by === user.id) {
    throw createError({ statusCode: 409, message: 'Request already sent, waiting for a response' })
  }

  if (!conversation) throw createError({ statusCode: 500, message: 'Failed to resolve conversation' })

  // The recipient replying to a pending request is an implicit accept.
  const wasPending = conversation.status === 'pending'
  if (wasPending && conversation.requested_by !== user.id) {
    await supabase
      .from('conversations')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', conversation.id)
  }

  const { data: message, error: msgError } = await supabase
    .from('dm_messages')
    .insert({ conversation_id: conversation.id, sender_id: user.id, content })
    .select()
    .single()

  if (msgError) throw createError({ statusCode: 500, message: 'Failed to send message' })

  await supabase
    .from('conversations')
    .update({ last_message_at: message.created_at })
    .eq('id', conversation.id)

  await sendPushNotification(recipientId, 'New message', content.slice(0, 80), '/messages')

  return {
    conversation_id: conversation.id,
    status: wasPending && conversation.requested_by !== user.id ? 'accepted' : conversation.status,
    message,
  }
})
