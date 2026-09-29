import type { LoungeAuthor, LoungeMessage, UserRole } from '~/types'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'

interface Row {
  id: string
  kind: 'user' | 'system'
  user_id: string | null
  content: string
  reply_to: string | null
  question_day: number | null
  created_at: string
}

export const LOUNGE_MESSAGE_COLUMNS = 'id, kind, user_id, content, reply_to, question_day, created_at'

/** Adds author details, the "Day N" lock badge and reply targets. */
export async function shapeLoungeMessages(rows: Row[]): Promise<LoungeMessage[]> {
  if (!rows.length) return []
  const supabase = useSupabaseAdmin()

  const replyIds = [...new Set(rows.map(r => r.reply_to).filter((x): x is string => !!x))]
  const known = new Map(rows.map(r => [r.id, r]))
  const missing = replyIds.filter(id => !known.has(id))
  if (missing.length) {
    const { data } = await supabase.from('lounge_messages').select(LOUNGE_MESSAGE_COLUMNS).in('id', missing).is('deleted_at', null)
    for (const r of (data ?? []) as Row[]) known.set(r.id, r)
  }

  const userIds = [...new Set([...known.values()].map(r => r.user_id).filter((x): x is string => !!x))]
  const authors = new Map<string, LoungeAuthor>()
  if (userIds.length) {
    const [{ data: profiles }, { data: locks }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, role, is_admin, leaderboard_opt_out')
        .in('id', userIds),
      supabase
        .from('loqs')
        .select('loqee_id, created_at')
        .in('loqee_id', userIds)
        .in('status', ['active', 'paused'])
        .order('created_at', { ascending: true }),
    ])
    // Oldest running lock wins: that is the streak people care about.
    const since = new Map<string, string>()
    for (const l of locks ?? []) if (!since.has(l.loqee_id)) since.set(l.loqee_id, l.created_at)
    const now = Date.now()
    for (const p of profiles ?? []) {
      const start = since.get(p.id)
      authors.set(p.id, {
        id: p.id,
        display_name: p.display_name,
        username: p.username,
        avatar_url: p.avatar_url,
        role: p.role as UserRole,
        team: !!p.is_admin,
        lock_day: start && !p.leaderboard_opt_out ? Math.floor((now - new Date(start).getTime()) / 86_400_000) + 1 : null,
      })
    }
  }

  return rows.map((r) => {
    const target = r.reply_to ? known.get(r.reply_to) : undefined
    const targetAuthor = target?.user_id ? authors.get(target.user_id) : undefined
    return {
      id: r.id,
      kind: r.kind,
      content: r.content,
      created_at: r.created_at,
      question_day: r.question_day,
      reply_to: target ? { id: target.id, name: targetAuthor?.display_name ?? targetAuthor?.username ?? 'ChastHub' } : null,
      author: r.user_id ? authors.get(r.user_id) ?? null : null,
    }
  })
}
