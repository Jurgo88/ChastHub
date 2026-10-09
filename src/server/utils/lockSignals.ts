// Per-lock signals for the dashboards (issue #24): what is waiting on whom,
// built from the open verifications, open tasks and recent check-ins of a set
// of locks. The builders are pure so they can be unit tested; the loaders
// below fetch everything for many locks in three queries.

import type { SupabaseClient } from '@supabase/supabase-js'
import { localParts, shiftDate } from '~/server/utils/checkin'

export interface SignalLock {
  id: string
  status: string
  created_at: string
  checkin_required?: boolean | null
  checkin_tz?: string | null
}

export interface OpenVerification {
  id: string
  loq_id: string
  code: string
  due_at: string
  penalty_minutes: number
  status: 'pending' | 'submitted'
  submitted_at: string | null
}

export interface OpenTask {
  id: string
  loq_id: string
  text: string
  due_at: string | null
  proof: 'none' | 'text' | 'photo'
  reward_minutes: number
  penalty_minutes: number
  status: 'open' | 'submitted'
  submitted_at: string | null
}

export interface RecentCheckin {
  loq_id: string
  local_date: string
  created_at: string
}

export interface LockSignals {
  /** Photos the wearer sent that wait for the keyholder. */
  pending_verifications: number
  /** Tasks the wearer handed in that wait for the keyholder. */
  submitted_tasks: number
  /** Earliest deadline among tasks still open for the wearer. */
  next_task_due_at: string | null
  last_checkin_at: string | null
  checked_in_today: boolean
  /** Compulsory check-in, nothing yesterday and nothing yet today. */
  missed_checkin: boolean
  /** The verification still open, waiting for a photo or for review. */
  open_verification: Omit<OpenVerification, 'loq_id'> | null
  /** Open and submitted tasks, soonest deadline first. */
  open_tasks: Omit<OpenTask, 'loq_id'>[]
}

export const OPEN_VERIFICATION_COLUMNS = 'id, loq_id, code, due_at, penalty_minutes, status, submitted_at'
export const OPEN_TASK_COLUMNS = 'id, loq_id, text, due_at, proof, reward_minutes, penalty_minutes, status, submitted_at'
/** How far back check-ins are read for last_checkin_at. */
export const CHECKIN_LOOKBACK_DAYS = 14

const byDue = (a: { due_at: string | null }, b: { due_at: string | null }) =>
  (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999')

const strip = <T extends { loq_id: string }>({ loq_id: _l, ...rest }: T) => rest

export function buildLockSignals(
  lock: SignalLock,
  verifications: OpenVerification[],
  tasks: OpenTask[],
  checkins: RecentCheckin[],
  now = Date.now(),
): LockSignals {
  const tz = lock.checkin_tz ?? 'UTC'
  const today = localParts(now, tz).date
  const yesterday = shiftDate(today, -1)
  const days = new Set(checkins.map(c => c.local_date))
  const last = checkins.reduce<string | null>((max, c) => (!max || c.created_at > max ? c.created_at : max), null)
  const openTasks = tasks.filter(t => t.status === 'open')
  const createdLocal = localParts(new Date(lock.created_at).getTime(), tz).date
  const open = [...verifications].sort((a, b) => a.due_at.localeCompare(b.due_at))[0] ?? null

  return {
    pending_verifications: verifications.filter(v => v.status === 'submitted').length,
    submitted_tasks: tasks.filter(t => t.status === 'submitted').length,
    next_task_due_at: openTasks.map(t => t.due_at).filter((d): d is string => !!d).sort()[0] ?? null,
    last_checkin_at: last,
    checked_in_today: days.has(today),
    missed_checkin: !!lock.checkin_required
      && lock.status === 'active'
      && createdLocal <= yesterday
      && !days.has(yesterday)
      && !days.has(today),
    open_verification: open ? strip(open) : null,
    open_tasks: [...tasks].sort(byDue).map(strip),
  }
}

export type AttentionKind = 'verification' | 'task' | 'request'

export interface AttentionPerson {
  id: string
  display_name: string | null
  avatar_url: string | null
}

export interface AttentionItem {
  kind: AttentionKind
  /** Verification, task or request id. */
  id: string
  loq_id: string
  loqee: AttentionPerson | null
  /** When it started waiting on the keyholder. */
  at: string
  code?: string
  penalty_minutes?: number
  text?: string
  proof?: OpenTask['proof']
  proof_text?: string | null
  reward_minutes?: number
  photo_url?: string | null
  duration_minutes?: number
  reason?: string | null
}

/** Everything waiting on the keyholder, oldest first. */
export function sortAttention(items: AttentionItem[]): AttentionItem[] {
  return [...items].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
}

function groupBy<T extends { loq_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const r of rows) map.set(r.loq_id, [...(map.get(r.loq_id) ?? []), r])
  return map
}

/** Open verifications, open tasks and recent check-ins of many locks, three queries in all. */
export async function loadSignalRows(supabase: SupabaseClient, loqIds: string[], now = Date.now()) {
  if (!loqIds.length) return { verifications: [], tasks: [], checkins: [] }
  const since = new Date(now - CHECKIN_LOOKBACK_DAYS * 86_400_000).toISOString()
  const [{ data: verifications }, { data: tasks }, { data: checkins }] = await Promise.all([
    supabase.from('loq_verifications').select(OPEN_VERIFICATION_COLUMNS).in('loq_id', loqIds).in('status', ['pending', 'submitted']),
    supabase.from('loq_tasks').select(OPEN_TASK_COLUMNS).in('loq_id', loqIds).in('status', ['open', 'submitted']),
    supabase.from('loq_checkins').select('loq_id, local_date, created_at').in('loq_id', loqIds).gte('created_at', since),
  ])
  return {
    verifications: (verifications ?? []) as OpenVerification[],
    tasks: (tasks ?? []) as OpenTask[],
    checkins: (checkins ?? []) as RecentCheckin[],
  }
}

/** Signals per lock id. A lock with no rows still gets an entry. */
export async function loadLockSignals(supabase: SupabaseClient, locks: SignalLock[], now = Date.now()): Promise<Map<string, LockSignals>> {
  const rows = await loadSignalRows(supabase, locks.map(l => l.id), now)
  const v = groupBy(rows.verifications)
  const t = groupBy(rows.tasks)
  const c = groupBy(rows.checkins)
  return new Map(locks.map(l => [l.id, buildLockSignals(l, v.get(l.id) ?? [], t.get(l.id) ?? [], c.get(l.id) ?? [], now)]))
}
