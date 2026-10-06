import type { SupabaseClient } from '@supabase/supabase-js'
import { lockHours } from '~/server/utils/profileStats'
import {
  challengePhase, evaluateEntry, rankEntries,
  type ChallengeLock, type ChallengeRules, type EntryStatus,
} from '~/utils/challenges'

export interface ChallengeRow extends ChallengeRules {
  id: string
  slug: string
  title: string
  description: string | null
  recurring: string | null
}

export const CHALLENGE_COLUMNS = 'id, slug, title, description, starts_at, ends_at, duration_minutes, max_pause_minutes, recurring, active'
export const LOCK_COLUMNS = 'id, status, created_at, accepted_at, loqed_until, ended_at, paused_at'

export type LockRow = ChallengeLock & { id: string; accepted_at: string | null }

interface EntryRow { user_id: string; loq_id: string | null; joined_at: string; completed_at: string | null; failed_at: string | null }

export interface BoardRow {
  rank: number
  id: string
  display_name: string
  username: string | null
  avatar_url: string | null
  status: EntryStatus
  hours: number
}

export interface ChallengeBoard {
  rows: BoardRow[]
  counts: { participants: number; active: number; completed: number; failed: number }
  me: { status: EntryStatus; rank: number | null; joined_at: string } | null
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** The board of one challenge, evaluated against the locks right now. */
export async function buildBoard(
  supabase: SupabaseClient,
  challenge: ChallengeRow,
  meId: string | null,
  now = Date.now(),
): Promise<ChallengeBoard> {
  const { data: entries } = await supabase
    .from('challenge_entries')
    .select('user_id, loq_id, joined_at, completed_at, failed_at')
    .eq('challenge_id', challenge.id)
    .limit(5000)
  const list = (entries ?? []) as EntryRow[]

  const loqIds = [...new Set(list.map(e => e.loq_id).filter((x): x is string => !!x))]
  const userIds = list.map(e => e.user_id)
  const [{ data: locks }, { data: people }] = await Promise.all([
    loqIds.length ? supabase.from('loqs').select(LOCK_COLUMNS).in('id', loqIds) : Promise.resolve({ data: [] }),
    userIds.length
      ? supabase.from('profiles').select('id, display_name, username, avatar_url, leaderboard_opt_out, status').in('id', userIds)
      : Promise.resolve({ data: [] }),
  ])
  const lockBy = new Map((locks as LockRow[] ?? []).map(l => [l.id, l]))
  const personBy = new Map((people ?? []).map(p => [p.id as string, p]))

  const counts = { participants: list.length, active: 0, completed: 0, failed: 0 }
  const scored: (BoardRow & { listed: boolean })[] = []
  let mine: { status: EntryStatus; joined_at: string; uid: string } | null = null

  for (const e of list) {
    const lock = e.loq_id ? lockBy.get(e.loq_id) ?? null : null
    const { status } = evaluateEntry(challenge, e, lock, now)
    counts[status]++
    if (meId && e.user_id === meId) mine = { status, joined_at: e.joined_at, uid: e.user_id }

    const p = personBy.get(e.user_id)
    if (!p || p.status !== 'active') continue
    scored.push({
      rank: 0,
      id: e.user_id,
      display_name: p.display_name ?? 'ChastHub user',
      username: p.username,
      avatar_url: p.avatar_url,
      status,
      hours: lock ? round1(lockHours({ ...lock, accepted_at: lock.accepted_at ?? null }, 'created', now)) : 0,
      listed: !p.leaderboard_opt_out,
    })
  }

  const ranked = rankEntries(scored.filter(r => r.listed)).map((r, i) => ({ ...r, rank: i + 1 }))
  const rows: BoardRow[] = ranked.slice(0, 50).map(({ listed: _listed, ...r }) => r)
  const myRank = mine ? ranked.find(r => r.id === mine!.uid)?.rank ?? null : null

  return { rows, counts, me: mine ? { status: mine.status, rank: myRank, joined_at: mine.joined_at } : null }
}

export function describeChallenge(c: ChallengeRow, now = Date.now()) {
  return { ...c, phase: challengePhase(c, now) }
}
