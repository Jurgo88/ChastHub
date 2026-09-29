import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const supabase = useSupabaseAdmin()

  const { data, error } = await supabase
    .from('conversations')
    .select(`
      id,
      status,
      requested_by,
      created_at,
      responded_at,
      last_message_at,
      user_a:profiles!user_a_id(id, display_name, username, avatar_url, role, is_admin, last_seen_at, show_online_status),
      user_b:profiles!user_b_id(id, display_name, username, avatar_url, role, is_admin, last_seen_at, show_online_status)
    `)
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (error) throw createError({ statusCode: 500, message: 'Failed to fetch conversations' })

  // Supabase/PostgREST has no DISTINCT ON, so pull every message for these
  // conversations (ordered newest-first, using the existing
  // idx_dm_messages_conversation index) and keep only the first — i.e. most
  // recent — row seen per conversation_id.
  const conversationIds = (data ?? []).map(c => c.id)
  const lastMessageByConv = new Map<string, { content: string; sender_id: string }>()
  if (conversationIds.length > 0) {
    const { data: msgs } = await supabase
      .from('dm_messages')
      .select('conversation_id, content, sender_id, created_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })

    for (const m of msgs ?? []) {
      if (!lastMessageByConv.has(m.conversation_id)) {
        lastMessageByConv.set(m.conversation_id, { content: m.content, sender_id: m.sender_id })
      }
    }
  }

  const conversations = (data ?? []).map((c) => {
    const otherUserRaw = c.user_a?.id === user.id ? c.user_b : c.user_a
    const otherUser = otherUserRaw
      ? {
          id: otherUserRaw.id,
          display_name: otherUserRaw.display_name,
          username: otherUserRaw.username,
          avatar_url: otherUserRaw.avatar_url,
          role: otherUserRaw.role,
          is_admin: otherUserRaw.is_admin,
          last_seen_at: otherUserRaw.show_online_status ? otherUserRaw.last_seen_at : null,
        }
      : null
    return {
      id: c.id,
      status: c.status,
      is_requester: c.requested_by === user.id,
      created_at: c.created_at,
      responded_at: c.responded_at,
      last_message_at: c.last_message_at,
      last_message: lastMessageByConv.get(c.id) ?? null,
      other_user: otherUser,
    }
  })

  return {
    conversations: conversations.filter(c => c.status === 'accepted'),
    incoming_requests: conversations.filter(c => c.status === 'pending' && !c.is_requester),
    sent_requests: conversations.filter(c => c.status === 'pending' && c.is_requester),
  }
})
