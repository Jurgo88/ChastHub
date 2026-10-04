import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'

export const REACTIONS = ['devil', 'lock', 'laugh', 'fire'] as const
export type ReactionKey = typeof REACTIONS[number]

export interface PublicLoqActivity {
  recent: { direction: 'add' | 'remove'; hours: number; at: string; name: string | null }[]
  totals: { visitors: number; added_hours: number; removed_hours: number }
  top: { name: string; username: string | null; avatar_url: string | null; hours: number }[]
  /** null when reactions are not available (table missing). */
  reactions: Record<ReactionKey, number> | null
}

interface Row { direction: 'add' | 'remove'; hours_added: number; created_at: string; user_id: string | null; ip_hash: string }

// Everything the public lock page shows around the clock: the last moves,
// totals, the signed-in visitors who added the most, and reaction counts.
// Names only for signed-in visitors who have not opted out of rankings.
export async function getPublicLoqActivity(loqId: string): Promise<PublicLoqActivity> {
  const supabase = useSupabaseAdmin()

  const [{ data: rowsData }, reactionsRes] = await Promise.all([
    supabase
      .from('loq_visitor_interactions')
      .select('direction, hours_added, created_at, user_id, ip_hash')
      .eq('loq_id', loqId)
      .order('created_at', { ascending: false })
      .limit(5000),
    supabase.from('loq_reactions').select('emoji').eq('loq_id', loqId).limit(20000),
  ])
  const rows = (rowsData ?? []) as Row[]

  const userIds = [...new Set(rows.map(r => r.user_id).filter((x): x is string => !!x))]
  const people = new Map<string, { name: string; username: string | null; avatar_url: string | null }>()
  if (userIds.length) {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url, leaderboard_opt_out, status')
      .in('id', userIds)
    for (const p of data ?? []) {
      if (p.leaderboard_opt_out || p.status !== 'active' || !p.display_name) continue
      people.set(p.id, { name: p.display_name, username: p.username, avatar_url: p.avatar_url })
    }
  }

  const recent = rows.slice(0, 10).map(r => ({
    direction: r.direction,
    hours: Number(r.hours_added),
    at: r.created_at,
    name: r.user_id ? people.get(r.user_id)?.name ?? null : null,
  }))

  let added = 0
  let removed = 0
  const byUser = new Map<string, number>()
  for (const r of rows) {
    const h = Number(r.hours_added)
    if (r.direction === 'add') {
      added += h
      if (r.user_id && people.has(r.user_id)) byUser.set(r.user_id, (byUser.get(r.user_id) ?? 0) + h)
    }
    else removed += h
  }

  const top = [...byUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, hours]) => ({ ...people.get(id)!, hours }))

  let reactions: PublicLoqActivity['reactions'] = null
  if (!reactionsRes.error) {
    reactions = { devil: 0, lock: 0, laugh: 0, fire: 0 }
    for (const r of reactionsRes.data ?? []) {
      if ((REACTIONS as readonly string[]).includes(r.emoji)) reactions[r.emoji as ReactionKey] += 1
    }
  }

  return {
    recent,
    totals: { visitors: new Set(rows.map(r => r.user_id ?? r.ip_hash)).size, added_hours: added, removed_hours: removed },
    top,
    reactions,
  }
}
