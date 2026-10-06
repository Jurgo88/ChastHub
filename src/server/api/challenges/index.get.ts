import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { CHALLENGE_COLUMNS, describeChallenge, type ChallengeRow } from '~/server/utils/challengeData'

// GET /api/challenges: the open and upcoming challenges (and recently finished
// ones) with how many people take part and whether you do.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const supabase = useSupabaseAdmin()

  const { data } = await supabase.from('challenges').select(CHALLENGE_COLUMNS).eq('active', true).order('starts_at', { ascending: true, nullsFirst: true }).limit(50)
  const now = Date.now()
  const challenges = ((data ?? []) as ChallengeRow[])
    .map(c => describeChallenge(c, now))
    // Finished more than a month ago: out of the list.
    .filter(c => !(c.phase === 'finished' && c.ends_at && now - new Date(c.ends_at).getTime() > 30 * 86_400_000))

  const ids = challenges.map(c => c.id)
  const { data: entries } = ids.length
    ? await supabase.from('challenge_entries').select('challenge_id, user_id, completed_at, failed_at').in('challenge_id', ids).limit(20000)
    : { data: [] }

  return {
    challenges: challenges.map((c) => {
      const mine = (entries ?? []).find(e => e.challenge_id === c.id && e.user_id === user.id)
      return {
        ...c,
        participants: (entries ?? []).filter(e => e.challenge_id === c.id).length,
        joined: !!mine,
        my_status: mine ? (mine.completed_at ? 'completed' : mine.failed_at ? 'failed' : 'active') : null,
      }
    }),
  }
})
