// Challenge rules, shared by the API and the pages. No Nitro/Supabase in here
// so it can be unit tested.
//
// A challenge is either a fixed period (starts_at to ends_at, everyone shares
// the clock) or a length from the moment you join (duration_minutes). You take
// part with a running lock and stay in while that lock stays on: it must not
// end before the challenge does, and a pause longer than max_pause_minutes
// counts as the lock being off (the same idea as Locktober survivors).

export interface ChallengeRules {
  active: boolean
  starts_at: string | null
  ends_at: string | null
  duration_minutes: number | null
  max_pause_minutes: number
}

export interface ChallengeLock {
  status: string
  created_at: string
  loqed_until: string | null
  ended_at: string | null
  paused_at: string | null
}

export interface ChallengeEntryState {
  joined_at: string
  completed_at: string | null
  failed_at: string | null
}

export type EntryStatus = 'active' | 'completed' | 'failed'
export type ChallengePhase = 'upcoming' | 'running' | 'finished' | 'closed'

const DAY = 86_400_000
const RUNNING = ['draft', 'pending', 'active', 'paused']

/** Joining a fixed challenge stays open for its first day, like Locktober survivors. */
export const JOIN_WINDOW_MS = DAY

export const isFixed = (c: ChallengeRules) => !!c.starts_at && !!c.ends_at

export function joinDeadline(c: ChallengeRules): number | null {
  return c.starts_at && c.ends_at
    ? Math.min(new Date(c.starts_at).getTime() + JOIN_WINDOW_MS, new Date(c.ends_at).getTime())
    : null
}

export function challengePhase(c: ChallengeRules, now: number): ChallengePhase {
  if (!c.active) return 'closed'
  if (!isFixed(c)) return 'running'
  if (now < new Date(c.starts_at!).getTime()) return 'upcoming'
  return now < new Date(c.ends_at!).getTime() ? 'running' : 'finished'
}

/** When this entry's challenge is over for them. */
export function entryEnd(c: ChallengeRules, entry: Pick<ChallengeEntryState, 'joined_at'>): number {
  return isFixed(c)
    ? new Date(c.ends_at!).getTime()
    : new Date(entry.joined_at).getTime() + (c.duration_minutes ?? 0) * 60_000
}

/** Null when the lock may join, otherwise the reason to show. */
export function joinProblem(c: ChallengeRules, lock: ChallengeLock | null, now: number): string | null {
  if (!c.active || challengePhase(c, now) === 'finished') return 'This challenge is closed.'

  const deadline = joinDeadline(c)
  if (deadline !== null && now >= deadline) return 'Joining is closed for this challenge.'

  if (!lock || !RUNNING.includes(lock.status) || !lock.loqed_until) return 'You need a running lock to join.'
  if (deadline !== null && new Date(lock.created_at).getTime() > deadline) {
    return 'Your lock started too late for this challenge.'
  }

  const needsUntil = isFixed(c) ? new Date(c.ends_at!).getTime() : now + (c.duration_minutes ?? 0) * 60_000
  if (new Date(lock.loqed_until).getTime() < needsUntil) {
    return 'Your lock ends before the challenge does. Get more time on it or start a longer lock.'
  }
  return null
}

export interface EntryResult { status: EntryStatus; at: number | null }

/**
 * Where an entry stands. A lock that ends at or after the finish counts as
 * done; before it, the entry failed when the lock ended. A pause that has run
 * longer than max_pause_minutes fails it at the moment the allowance ran out.
 */
export function evaluateEntry(
  c: ChallengeRules,
  entry: ChallengeEntryState,
  lock: ChallengeLock | null,
  now: number,
): EntryResult {
  if (entry.completed_at) return { status: 'completed', at: new Date(entry.completed_at).getTime() }
  if (entry.failed_at) return { status: 'failed', at: new Date(entry.failed_at).getTime() }

  const end = entryEnd(c, entry)
  if (!lock) return { status: 'failed', at: now }

  if (lock.status === 'ended' || lock.status === 'cancelled') {
    const stoppedAt = lock.ended_at ? new Date(lock.ended_at).getTime() : now
    return stoppedAt >= end ? { status: 'completed', at: end } : { status: 'failed', at: stoppedAt }
  }

  if (lock.status === 'paused' && lock.paused_at) {
    const offAt = new Date(lock.paused_at).getTime() + c.max_pause_minutes * 60_000
    if (offAt <= Math.min(now, end)) return { status: 'failed', at: offAt }
  }

  return now >= end ? { status: 'completed', at: end } : { status: 'active', at: null }
}

const ORDER: Record<EntryStatus, number> = { completed: 0, active: 1, failed: 2 }

/** Board order: finishers, then those still going, longest lock first. Failed entries are left off. */
export function rankEntries<T extends { status: EntryStatus; hours: number }>(rows: T[]): T[] {
  return rows
    .filter(r => r.status !== 'failed')
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.hours - a.hours)
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
