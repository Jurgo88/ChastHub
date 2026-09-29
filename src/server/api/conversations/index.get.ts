import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

interface InboxRow {
  id: string
  status: 'pending' | 'accepted' | 'declined'
  requested_by: string
  created_at: string
  responded_at: string | null
  last_message_at: string | null
  other_id: string
  my_last_read_at: string | null
  other_last_read_at: string | null
  last_content: string | null
  last_sender: string | null
  unread: number
}

interface OtherProfile {
  id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
  role: string
  is_admin: boolean
  last_seen_at: string | null
  show_online_status: boolean
  show_read_receipts: boolean
}

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const supabase = useSupabaseAdmin()

  const { data, error } = await supabase.rpc('dm_inbox', { p_user: user.id })
  if (error) throw createError({ statusCode: 500, message: 'Failed to fetch conversations' })
  const rows = (data ?? []) as InboxRow[]

  const otherIds = [...new Set(rows.map(r => r.other_id))]
  const profiles = new Map<string, OtherProfile>()
  // What the other person is to me in a running lock: my keyholder or my wearer.
  const locks = new Map<string, { id: string; relation: 'keyholder' | 'wearer'; status: string; loqed_until: string | null }>()
  let myReceipts = true

  if (otherIds.length) {
    const [profRes, meRes, lockRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, role, is_admin, last_seen_at, show_online_status, show_read_receipts')
        .in('id', otherIds),
      supabase.from('profiles').select('show_read_receipts').eq('id', user.id).maybeSingle(),
      supabase
        .from('loqs')
        .select('id, loqee_id, loqholder_id, status, loqed_until')
        .in('status', ['active', 'paused'])
        .or(`and(loqee_id.eq.${user.id},loqholder_id.in.(${otherIds.join(',')})),and(loqholder_id.eq.${user.id},loqee_id.in.(${otherIds.join(',')}))`),
    ])
    for (const p of (profRes.data ?? []) as OtherProfile[]) profiles.set(p.id, p)
    myReceipts = meRes.data?.show_read_receipts ?? true
    for (const l of lockRes.data ?? []) {
      const otherId = l.loqee_id === user.id ? l.loqholder_id : l.loqee_id
      if (!otherId || locks.has(otherId)) continue
      locks.set(otherId, {
        id: l.id,
        relation: l.loqee_id === user.id ? 'keyholder' : 'wearer',
        status: l.status,
        loqed_until: l.loqed_until,
      })
    }
  }

  const conversations = rows.map((r) => {
    const p = profiles.get(r.other_id)
    const receipts = myReceipts && (p?.show_read_receipts ?? true)
    return {
      id: r.id,
      status: r.status,
      is_requester: r.requested_by === user.id,
      created_at: r.created_at,
      responded_at: r.responded_at,
      last_message_at: r.last_message_at,
      last_message: r.last_content != null && r.last_sender ? { content: r.last_content, sender_id: r.last_sender } : null,
      unread: r.unread,
      other_last_read_at: receipts ? r.other_last_read_at : null,
      read_receipts: receipts,
      lock: locks.get(r.other_id) ?? null,
      other_user: p
        ? {
            id: p.id,
            display_name: p.display_name,
            username: p.username,
            avatar_url: p.avatar_url,
            role: p.role,
            is_admin: p.is_admin,
            last_seen_at: p.show_online_status ? p.last_seen_at : null,
          }
        : null,
    }
  })

  return {
    conversations: conversations.filter(c => c.status === 'accepted'),
    incoming_requests: conversations.filter(c => c.status === 'pending' && !c.is_requester),
    sent_requests: conversations.filter(c => c.status === 'pending' && c.is_requester),
  }
})
