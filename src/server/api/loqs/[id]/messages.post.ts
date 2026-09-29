import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { sendPushNotification } from '~/server/utils/sendPushNotification'
import type { LoqMessage } from '~/types'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)

  if (!await checkRateLimit(`msg:${user.id}`, 20, 60_000)) {
    throw createError({ statusCode: 429, message: 'Too many messages. Slow down.' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const body = await readBody<{ content: string }>(event)
  const content = body?.content?.trim() ?? ''

  if (!content) throw createError({ statusCode: 400, message: 'Message cannot be empty' })
  if (content.length > 5000) throw createError({ statusCode: 400, message: 'Message too long (max 5000 characters)' })

  const supabase = useSupabaseAdmin()

  const { data: loq } = await supabase
    .from('loqs')
    .select('id, loqee_id, loqholder_id, status')
    .eq('id', id)
    .maybeSingle()

  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  if (loq.loqee_id !== user.id && loq.loqholder_id !== user.id) {
    throw createError({ statusCode: 403, message: 'Not a participant in this lock' })
  }
  if (loq.status === 'ended' || loq.status === 'cancelled') {
    throw createError({ statusCode: 403, message: 'Lock has ended' })
  }

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      loq_id: id,
      sender_id: user.id,
      content,
      loqee_id: loq.loqee_id,
      loqholder_id: loq.loqholder_id,
    })
    .select()
    .single<LoqMessage>()

  if (error) throw createError({ statusCode: 500, message: 'Failed to send message' })

  const recipientId = user.id === loq.loqee_id ? loq.loqholder_id : loq.loqee_id
  await sendPushNotification(recipientId, 'New message', content.slice(0, 80), '/dashboard')

  return message
})
