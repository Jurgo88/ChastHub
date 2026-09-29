import type { Conversation, ConversationStatus, DmMessage } from '~/types'
import { LoqApiError } from '~/composables/useLoq'

// accept/decline return the raw conversations row, not the shaped
// list-view Conversation (no is_requester/other_user — those are computed
// only by GET /api/conversations).
export interface ConversationRow {
  id: string
  status: ConversationStatus
  requested_by: string
  created_at: string
  responded_at: string | null
  last_message_at: string | null
}

type FetchError = { data?: { message?: string }; status?: number; statusCode?: number }

function extractError(err: unknown): LoqApiError {
  const fe = err as FetchError
  const statusCode = fe?.status ?? fe?.statusCode ?? 500
  const message = fe?.data?.message ?? (err as Error)?.message ?? 'Something went wrong. Please try again.'
  return new LoqApiError(message, statusCode)
}

export interface ConversationLists {
  conversations: Conversation[]
  incoming_requests: Conversation[]
  sent_requests: Conversation[]
}

export function useMessaging() {
  const { authFetch } = useAuthFetch()

  async function fetchConversations(): Promise<ConversationLists> {
    try {
      return await authFetch<ConversationLists>('/api/conversations')
    }
    catch (err) { throw extractError(err) }
  }

  async function startConversation(recipientId: string, content: string) {
    try {
      return await authFetch<{ conversation_id: string; status: string; message: DmMessage }>(
        '/api/conversations',
        { method: 'POST', body: { recipient_id: recipientId, content } },
      )
    }
    catch (err) { throw extractError(err) }
  }

  async function fetchMessages(conversationId: string, offset = 0): Promise<{ messages: DmMessage[]; total: number }> {
    try {
      return await authFetch<{ messages: DmMessage[]; total: number }>(`/api/conversations/${conversationId}/messages?offset=${offset}`)
    }
    catch (err) { throw extractError(err) }
  }

  async function sendMessage(conversationId: string, content: string): Promise<DmMessage> {
    try {
      return await authFetch<DmMessage>(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: { content },
      })
    }
    catch (err) { throw extractError(err) }
  }

  async function acceptConversation(conversationId: string): Promise<ConversationRow> {
    try {
      return await authFetch<ConversationRow>(`/api/conversations/${conversationId}/accept`, { method: 'POST' })
    }
    catch (err) { throw extractError(err) }
  }

  async function declineConversation(conversationId: string): Promise<ConversationRow> {
    try {
      return await authFetch<ConversationRow>(`/api/conversations/${conversationId}/decline`, { method: 'POST' })
    }
    catch (err) { throw extractError(err) }
  }

  async function markRead(conversationId: string): Promise<string | null> {
    try {
      const res = await authFetch<{ last_read_at: string }>(`/api/conversations/${conversationId}/read`, { method: 'POST' })
      return res.last_read_at
    }
    catch { return null }
  }

  return { markRead, fetchConversations, startConversation, fetchMessages, sendMessage, acceptConversation, declineConversation }
}
