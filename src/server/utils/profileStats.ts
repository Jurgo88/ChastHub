import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProfileStats, UserRole } from '~/types'

// Numbers for the profile header. They follow the leaderboard's own rules so
// the two never disagree: a wearer's lock counts once it has ended and had a
// keyholder, and its length is created_at to loqed_until, exactly as in the
// loqee_leaderboard views (migration 001).

const HOUR = 3600 * 1000

function hoursBetween(from: string | null, to: string | null): number {
  if (!from || !to) return 0
  return Math.max(0, (new Date(to).getTime() - new Date(from).getTime()) / HOUR)
}

const round1 = (n: number) => Math.round(n * 10) / 10

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
    const [{ data: ended }, { count: holding }, rank] = await Promise.all([
      supabase.from('loqs')
        .select('created_at, loqed_until')
        .eq('loqholder_id', userId)
        .eq('status', 'ended'),
      supabase.from('loqs')
        .select('id', { count: 'exact', head: true })
        .eq('loqholder_id', userId)
        .in('status', ['active', 'paused']),
      opts.leaderboardOptOut
        ? Promise.resolve({ data: null })
        : supabase.from('loqholder_leaderboard_all').select('rank').eq('id', userId).maybeSingle(),
    ])

    const rows = ended ?? []
    stats.locks_completed = rows.length
    stats.total_hours = round1(rows.reduce((sum, r) => sum + hoursBetween(r.created_at, r.loqed_until), 0))
    stats.holding_now = holding ?? 0
    stats.rank = (rank.data as { rank: number } | null)?.rank ?? null
    return stats
  }

  if (role === 'loqee') {
    const [{ data: ended }, { data: running }, rank] = await Promise.all([
      supabase.from('loqs')
        .select('created_at, loqed_until')
        .eq('loqee_id', userId)
        .eq('status', 'ended')
        .not('loqholder_id', 'is', null)
        .not('loqed_until', 'is', null),
      supabase.from('loqs')
        .select('public_link_id, listed_in_discover, loqholder_id, status, loqed_until, visitor_permission')
        .eq('loqee_id', userId)
        .in('status', ['pending', 'active', 'paused'])
        .maybeSingle(),
      opts.leaderboardOptOut
        ? Promise.resolve({ data: null })
        : supabase.from('loqee_leaderboard_all').select('rank').eq('id', userId).maybeSingle(),
    ])

    const hours = (ended ?? []).map(r => hoursBetween(r.created_at, r.loqed_until))
    stats.locks_completed = hours.length
    stats.total_hours = round1(hours.reduce((a, b) => a + b, 0))
    stats.longest_hours = round1(hours.reduce((a, b) => Math.max(a, b), 0))
    stats.rank = (rank.data as { rank: number } | null)?.rank ?? null

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
