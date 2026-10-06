import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { buildSummary, buildHistory, HISTORY_LOCK_COLUMNS, type AuditRow, type LockHistoryRow, type VisitorRow } from '~/server/utils/loqHistory'

type VisitorWithIds = VisitorRow & { loq_id: string; user_id: string | null; ip_hash: string }

// GET /api/locks/history: the user's finished locks (as wearer or keyholder),
// newest first, each with its summary numbers. Cancelled locks that never had
// a keyholder are left out: nothing happened on them.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const supabase = useSupabaseAdmin()

  const { data } = await supabase
    .from('loqs')
    .select(HISTORY_LOCK_COLUMNS)
    .or(`loqee_id.eq.${user.id},loqholder_id.eq.${user.id}`)
    .in('status', ['ended', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(50)
  const locks = ((data ?? []) as LockHistoryRow[]).filter(l => l.status === 'ended' || l.loqholder_id)
  if (!locks.length) return { locks: [] }

  const ids = locks.map(l => l.id)
  const [{ data: audit }, { data: visitors }] = await Promise.all([
    supabase.from('audit_log').select('action, actor_id, created_at, details').in('details->>loq_id', ids).limit(10000),
    supabase.from('loq_visitor_interactions').select('loq_id, direction, hours_added, created_at, user_id, ip_hash').in('loq_id', ids).limit(20000),
  ])

  const auditBy = new Map<string, AuditRow[]>()
  for (const a of (audit ?? []) as AuditRow[]) {
    const lid = String(a.details?.loq_id ?? '')
    if (!auditBy.has(lid)) auditBy.set(lid, [])
    auditBy.get(lid)!.push(a)
  }
  const visitorsBy = new Map<string, VisitorWithIds[]>()
  for (const v of (visitors ?? []) as VisitorWithIds[]) {
    if (!visitorsBy.has(v.loq_id)) visitorsBy.set(v.loq_id, [])
    visitorsBy.get(v.loq_id)!.push(v)
  }

  const otherIds = [...new Set(locks.map(l => (l.loqee_id === user.id ? l.loqholder_id : l.loqee_id)).filter((x): x is string => !!x))]
  const { data: people } = otherIds.length
    ? await supabase.from('profiles').select('id, display_name').in('id', otherIds)
    : { data: [] }
  const names = new Map((people ?? []).map(p => [p.id as string, p.display_name as string | null]))

  return {
    locks: locks.map((l) => {
      const v = visitorsBy.get(l.id) ?? []
      const events = buildHistory(l, auditBy.get(l.id) ?? [], v)
      const otherId = l.loqee_id === user.id ? l.loqholder_id : l.loqee_id
      return {
        id: l.id,
        created_at: l.created_at,
        role: l.loqee_id === user.id ? 'wearer' : 'keyholder',
        with: otherId ? names.get(otherId) ?? null : null,
        summary: buildSummary(l, events, new Set(v.map(x => x.user_id ?? x.ip_hash)).size),
      }
    }),
  }
})
