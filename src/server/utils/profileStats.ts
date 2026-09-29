import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProfileStats, UserRole } from '~/types'

// Numbers for the profile header, counted exactly like the Stats page
// (stats_board in migration 004), so the two never disagree:
//   - only locks that had a keyholder count;
//   - a lock runs from created_at (the wearer is locked from creation) to
//     whichever came first of ended_at and loqed_until; a running lock runs
//     until now, a paused one until it was paused;
//   - keyholder time starts at accepted_at.
// The rank shown is the one on the Stats page's main board for the role.

const HOUR = 3600 * 1000
const RUNNING = ['draft', 'pending', 'active', 'paused']

interface LockRow {
  status: string
  created_at: string
  accepted_at: string | null
  loqed_until: string | null
  ended_at: string | null
  paused_at: string | null
}

export function lockEnd(l: LockRow, now = Date.now()): number {
  const until = l.loqed_until ? new Date(l.loqed_until).getTime() : now
  if (l.status === 'ended') return Math.min(l.ended_at ? new Date(l.ended_at).getTime() : until, until)
  if (l.status === 'paused') return Math.min(l.paused_at ? new Date(l.paused_at).getTime() : now, until, now)
  return Math.min(until, now)
}

export function lockHours(l: LockRow, from: 'created' | 'accepted' = 'created', now = Date.now()): number {
  const startIso = from === 'accepted' ? (l.accepted_at ?? l.created_at) : l.created_at
  return Math.max(0, (lockEnd(l, now) - new Date(startIso).getTime()) / HOUR)
}

const round1 = (n: number) => Math.round(n * 10) / 10
const LOCK_COLUMNS = 'status, created_at, accepted_at, loqed_until, ended_at, paused_at'

async function rankOn(supabase: SupabaseClient, board: string, userId: string): Promise<number | null> {
  const { data } = await supabase.rpc('stats_board', { p_board: board, p_period: 'all', p_limit: 0, p_user: userId })
  return (data as { me: { rank: number } | null } | null)?.me?.rank ?? null
}

export async function getProfileStats(
  supabase: SupabaseClient,
  userId: string,
  role: UserRole,
  opts: { leaderboardOptOut: boolean },
): Promise<ProfileStats> {
  const stats: ProfileStats = {
    role,
    locks_completed: 0,
    total_hours: 0,
    longest_hours: 0,
    holding_now: 0,
    rank: null,
    public_lock: null,
  }

  if (role === 'loqholder') {
    const [{ data }, rank] = await Promise.all([
      supabase.from('loqs')
        .select(LOCK_COLUMNS)
        .eq('loqholder_id', userId)
        .in('status', [...RUNNING, 'ended'])
        .not('loqed_until', 'is', null),
      opts.leaderboardOptOut ? Promise.resolve(null) : rankOn(supabase, 'keyholder_locks', userId),
    ])

    const rows = (data ?? []) as LockRow[]
    stats.locks_completed = rows.length
    stats.total_hours = round1(rows.reduce((sum, r) => sum + lockHours(r, 'accepted'), 0))
    stats.holding_now = rows.filter(r => RUNNING.includes(r.status)).length
    stats.rank = rank
    return stats
  }

  if (role === 'loqee') {
    const [{ data }, { data: running }, rank] = await Promise.all([
      supabase.from('loqs')
        .select(LOCK_COLUMNS)
        .eq('loqee_id', userId)
        .in('status', [...RUNNING, 'ended'])
        .not('loqholder_id', 'is', null)
        .not('loqed_until', 'is', null),
      supabase.from('loqs')
        .select('public_link_id, listed_in_discover, loqholder_id, status, loqed_until, visitor_permission')
        .eq('loqee_id', userId)
        .in('status', ['pending', 'active', 'paused'])
        .maybeSingle(),
      opts.leaderboardOptOut ? Promise.resolve(null) : rankOn(supabase, 'wearer_longest', userId),
    ])

    const rows = (data ?? []) as LockRow[]
    const hours = rows.map(r => lockHours(r))
    stats.locks_completed = rows.filter(r => r.status === 'ended').length
    stats.total_hours = round1(hours.reduce((a, b) => a + b, 0))
    stats.longest_hours = round1(hours.reduce((a, b) => Math.max(a, b), 0))
    stats.rank = rank

    // Only a lock that Key Drop already lists (same rule as that listing:
    // listed, unpaired, has a link). Pointing at it from the profile reveals
    // nothing that is not public already; a paired lock stays off the profile.
    if (running?.listed_in_discover && !running.loqholder_id && running.public_link_id) {
      stats.public_lock = {
        public_id: running.public_link_id,
        ends_at: running.loqed_until,
        paused: running.status === 'paused',
        visitor_permission: running.visitor_permission,
      }
    }
  }

  return stats
}

/** Whole years from a birth year, assuming the birthday has passed. */
export function ageFromBirthYear(birthYear: number | null): number | null {
  if (!birthYear) return null
  return new Date().getUTCFullYear() - birthYear
}
