import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAdminLevel, requireAuth } from '~/server/utils/auth'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LIMIT = 100

interface Person { id: string; display_name: string | null; email: string }

// TASK-170 — who this user has been talking to: their DM conversations and
// their loqs (each loq has its own chat), with the other party and a message
// count. Each one opens in /admin/messages. Same access as the user page.
export default defineEventHandler(async (event) => {
  const { adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['support', 'super_admin'])

  const id = getRouterParam(event, 'id')
  if (!id || !UUID.test(id)) throw createError({ statusCode: 404, message: 'User not found' })

  const supabase = useSupabaseAdmin()
  const person = 'id, display_name, email'

  // `id` is a validated UUID, so it is safe inside or().
  const [dms, loqs] = await Promise.all([
    supabase
      .from('conversations')
      .select(`id, status, created_at, last_message_at, user_a_id,
        user_a:profiles!user_a_id(${person}), user_b:profiles!user_b_id(${person}),
        dm_messages(count)`)
      .or(`user_a_id.eq.${id},user_b_id.eq.${id}`)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(LIMIT),
    supabase
      .from('loqs')
      .select(`id, status, created_at, loqee_id,
        loqee:profiles!loqee_id(${person}), loqholder:profiles!loqholder_id(${person}),
        messages(count)`)
      .or(`loqee_id.eq.${id},loqholder_id.eq.${id}`)
      .order('created_at', { ascending: false })
      .limit(LIMIT),
  ])

  if (dms.error || loqs.error) {
    console.error('[admin/users/conversations]', dms.error?.message ?? loqs.error?.message)
    throw createError({ statusCode: 500, message: 'Failed to fetch conversations' })
  }

  const count = (rel: unknown) => (Array.isArray(rel) ? (rel[0] as { count?: number })?.count : 0) ?? 0

  return {
    dms: (dms.data ?? []).map((c: any) => ({
      id: c.id,
      status: c.status,
      created_at: c.created_at,
      last_message_at: c.last_message_at,
      other: (c.user_a_id === id ? c.user_b : c.user_a) as Person | null,
      messages: count(c.dm_messages),
    })),
    loqs: (loqs.data ?? []).map((l: any) => ({
      id: l.id,
      status: l.status,
      created_at: l.created_at,
      role: l.loqee_id === id ? 'loqee' : 'loqholder',
      other: (l.loqee_id === id ? l.loqholder : l.loqee) as Person | null,
      messages: count(l.messages),
    })),
  }
})
