import type { SupabaseClient } from '@supabase/supabase-js'
import { lockHours } from '~/server/utils/profileStats'

// The history of one lock: a single timeline put together from the lock row,
// its audit_log entries and the Key Drop visitor interactions. Nothing here
// ever carries the combination, names of visitors or anything else that must
// not leave the two people on the lock.

export type HistoryType =
  | 'created' | 'accepted' | 'time_added' | 'time_removed' | 'paused' | 'resumed'
  | 'visitors_added' | 'visitors_removed' | 'revealed' | 'ended' | 'cancelled'
  | 'checkin' | 'wheel' | 'verification' | 'task'

export type HistoryFilter = 'all' | 'time' | 'pauses' | 'visitors'
export const HISTORY_FILTERS: readonly HistoryFilter[] = ['all', 'time', 'pauses', 'visitors']

export interface HistoryEvent {
  type: HistoryType
  at: string
  actor: 'keyholder' | 'wearer' | 'visitor' | 'system'
  /** Signed minutes this event moved the end of the lock by. */
  delta_minutes?: number
  /** Number of visitor moves rolled into this event. */
  count?: number
  /** Mood of a check-in. */
  mood?: string
  /** Outcome of a verification: approved, rejected or missed. */
  verification?: 'approved' | 'rejected' | 'missed'
  /** Outcome of a keyholder task. */
  task?: 'done' | 'failed' | 'missed'
  /** Result of a wheel spin, e.g. "+6h". */
  label?: string
}

export interface LockHistoryRow {
  id: string
  loqee_id: string
  loqholder_id: string | null
  status: string
  created_at: string
  accepted_at: string | null
  loqed_until: string | null
  ended_at: string | null
  paused_at: string | null
  combination_revealed_at: string | null
}

export interface AuditRow { action: string; actor_id: string | null; created_at: string; details: Record<string, unknown> | null }
export interface VisitorRow { direction: 'add' | 'remove'; hours_added: number | string; created_at: string }
export interface CheckinRow { mood: string; created_at: string }

/** More visitor moves than this on one day, in one direction, collapse into one line. */
export const VISITOR_MERGE_OVER = 3

const FILTER_TYPES: Record<Exclude<HistoryFilter, 'all'>, HistoryType[]> = {
  time: ['time_added', 'time_removed', 'visitors_added', 'visitors_removed', 'wheel'],
  pauses: ['paused', 'resumed'],
  visitors: ['visitors_added', 'visitors_removed'],
}

export function filterHistory(events: HistoryEvent[], filter: HistoryFilter): HistoryEvent[] {
  if (filter === 'all') return events
  const types = FILTER_TYPES[filter]
  return events.filter(e => types.includes(e.type))
}

function mergeVisitors(rows: VisitorRow[]): HistoryEvent[] {
  const groups = new Map<string, VisitorRow[]>()
  for (const r of rows) {
    const key = `${r.created_at.slice(0, 10)}:${r.direction}`
    const list = groups.get(key)
    if (list) list.push(r)
    else groups.set(key, [r])
  }

  const out: HistoryEvent[] = []
  for (const list of groups.values()) {
    const dir = list[0]!.direction
    const sign = dir === 'add' ? 1 : -1
    const type: HistoryType = dir === 'add' ? 'visitors_added' : 'visitors_removed'
    if (list.length > VISITOR_MERGE_OVER) {
      const minutes = list.reduce((s, r) => s + Number(r.hours_added) * 60, 0)
      const latest = list.reduce((a, r) => (r.created_at > a ? r.created_at : a), list[0]!.created_at)
      out.push({ type, at: latest, actor: 'visitor', delta_minutes: Math.round(sign * minutes), count: list.length })
    }
    else {
      for (const r of list) {
        out.push({ type, at: r.created_at, actor: 'visitor', delta_minutes: Math.round(sign * Number(r.hours_added) * 60), count: 1 })
      }
    }
  }
  return out
}

/** Oldest first. */
export function buildHistory(
  loq: LockHistoryRow,
  audit: AuditRow[],
  visitors: VisitorRow[],
  checkins: CheckinRow[] = [],
): HistoryEvent[] {
  const events: HistoryEvent[] = [{ type: 'created', at: loq.created_at, actor: 'wearer' }]

  const actorOf = (id: string | null): HistoryEvent['actor'] =>
    id && id === loq.loqholder_id ? 'keyholder' : id && id === loq.loqee_id ? 'wearer' : 'system'

  for (const a of audit) {
    const actor = actorOf(a.actor_id)
    switch (a.action) {
      case 'loq_accepted': events.push({ type: 'accepted', at: a.created_at, actor }); break
      case 'loq_paused': events.push({ type: 'paused', at: a.created_at, actor }); break
      case 'loq_resumed': events.push({ type: 'resumed', at: a.created_at, actor }); break
      case 'loq_ended': events.push({ type: 'ended', at: a.created_at, actor }); break
      case 'loq_cancelled': events.push({ type: 'cancelled', at: a.created_at, actor }); break
      case 'loq_verification_approved': events.push({ type: 'verification', at: a.created_at, actor, verification: 'approved' }); break
      case 'loq_verification_rejected': events.push({ type: 'verification', at: a.created_at, actor, verification: 'rejected' }); break
      case 'loq_verification_missed': events.push({ type: 'verification', at: a.created_at, actor: 'system', verification: 'missed' }); break
      case 'loq_task_done': events.push({ type: 'task', at: a.created_at, actor, task: 'done' }); break
      case 'loq_task_failed': events.push({ type: 'task', at: a.created_at, actor: a.details?.missed ? 'system' : actor, task: a.details?.missed ? 'missed' : 'failed' }); break
      case 'loq_wheel_spin': {
        const delta = Number(a.details?.delta_minutes)
        events.push({
          type: 'wheel',
          at: a.created_at,
          actor,
          label: typeof a.details?.label === 'string' ? a.details.label : undefined,
          ...(Number.isFinite(delta) && delta !== 0 ? { delta_minutes: delta } : {}),
        })
        break
      }
      case 'loq_time_added':
      case 'loq_time_removed': {
        const raw = Number(a.details?.delta_minutes)
        if (!Number.isFinite(raw) || raw === 0) break
        events.push({ type: raw > 0 ? 'time_added' : 'time_removed', at: a.created_at, actor, delta_minutes: raw })
        break
      }
    }
  }

  events.push(...mergeVisitors(visitors))
  for (const c of checkins) events.push({ type: 'checkin', at: c.created_at, actor: 'wearer', mood: c.mood })

  // A lock that ran out on its own leaves no audit row.
  if (loq.status === 'ended' && !events.some(e => e.type === 'ended')) {
    events.push({ type: 'ended', at: loq.ended_at ?? loq.loqed_until ?? loq.created_at, actor: 'system' })
  }
  if (loq.combination_revealed_at) events.push({ type: 'revealed', at: loq.combination_revealed_at, actor: 'system' })

  return events.sort((a, b) => a.at.localeCompare(b.at))
}

export type LockOutcome = 'running' | 'completed' | 'ended_early' | 'cancelled'

export interface LockSummary {
  outcome: LockOutcome
  total_hours: number
  keyholder_added_hours: number
  keyholder_removed_hours: number
  visitor_added_hours: number
  visitor_removed_hours: number
  visitors: number
  pauses: number
  longest_stretch_hours: number
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function lockOutcome(loq: Pick<LockHistoryRow, 'status' | 'ended_at' | 'loqed_until'>): LockOutcome {
  if (loq.status === 'cancelled') return 'cancelled'
  if (loq.status !== 'ended') return 'running'
  // Ended before the clock ran out = ended by the keyholder (or the wearer on a self-lock).
  if (loq.ended_at && loq.loqed_until && new Date(loq.ended_at).getTime() < new Date(loq.loqed_until).getTime() - 60_000) {
    return 'ended_early'
  }
  return 'completed'
}

export function buildSummary(loq: LockHistoryRow, events: HistoryEvent[], visitorCount: number, now = Date.now()): LockSummary {
  let khAdded = 0
  let khRemoved = 0
  let vAdded = 0
  let vRemoved = 0
  let pauses = 0
  for (const e of events) {
    const m = (e.delta_minutes ?? 0) / 60
    if (e.type === 'time_added') khAdded += m
    else if (e.type === 'time_removed') khRemoved += -m
    else if (e.type === 'visitors_added') vAdded += m
    else if (e.type === 'visitors_removed') vRemoved += -m
    else if (e.type === 'paused') pauses++
  }

  // Longest run between the start (or a resume) and the next pause (or the end).
  const startMs = new Date(loq.created_at).getTime()
  const endMs = startMs + lockHours(loq, 'created', now) * 3_600_000
  let runStart: number | null = startMs
  let longest = 0
  for (const e of events) {
    const t = new Date(e.at).getTime()
    if (e.type === 'paused' && runStart !== null) { longest = Math.max(longest, t - runStart); runStart = null }
    else if (e.type === 'resumed' && runStart === null) runStart = t
  }
  if (runStart !== null) longest = Math.max(longest, endMs - runStart)

  return {
    outcome: lockOutcome(loq),
    total_hours: round1(lockHours(loq, 'created', now)),
    keyholder_added_hours: round1(khAdded),
    keyholder_removed_hours: round1(khRemoved),
    visitor_added_hours: round1(vAdded),
    visitor_removed_hours: round1(vRemoved),
    visitors: visitorCount,
    pauses,
    longest_stretch_hours: round1(Math.max(0, longest) / 3_600_000),
  }
}

export const HISTORY_LOCK_COLUMNS =
  'id, loqee_id, loqholder_id, status, created_at, accepted_at, loqed_until, ended_at, paused_at, combination_revealed_at'

/** Loads the lock and its raw sources. Throws 404/403 unless the user is on the lock (or an admin). */
export async function loadLockHistory(supabase: SupabaseClient, loqId: string, userId: string, isAdmin: boolean) {
  const { data: loq } = await supabase.from('loqs').select(HISTORY_LOCK_COLUMNS).eq('id', loqId).maybeSingle<LockHistoryRow>()
  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  if (!isAdmin && loq.loqee_id !== userId && loq.loqholder_id !== userId) {
    throw createError({ statusCode: 403, message: 'Access denied' })
  }

  const [{ data: audit }, { data: visitors }, { data: checkins }] = await Promise.all([
    supabase
      .from('audit_log')
      .select('action, actor_id, created_at, details')
      .eq('details->>loq_id', loqId)
      .order('created_at', { ascending: true })
      .limit(2000),
    supabase
      .from('loq_visitor_interactions')
      .select('direction, hours_added, created_at, user_id, ip_hash')
      .eq('loq_id', loqId)
      .order('created_at', { ascending: true })
      .limit(5000),
    supabase
      .from('loq_checkins')
      .select('mood, created_at')
      .eq('loq_id', loqId)
      .order('created_at', { ascending: true })
      .limit(1000),
  ])

  const visitorRows = (visitors ?? []) as (VisitorRow & { user_id: string | null; ip_hash: string })[]
  const events = buildHistory(loq, (audit ?? []) as AuditRow[], visitorRows, (checkins ?? []) as CheckinRow[])
  const visitorCount = new Set(visitorRows.map(v => v.user_id ?? v.ip_hash)).size
  return { loq, events, visitorCount }
}
