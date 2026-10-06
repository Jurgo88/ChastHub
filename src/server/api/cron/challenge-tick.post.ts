import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireCronAuth } from '~/server/utils/cronAuth'
import { sendPushNotification } from '~/server/utils/sendPushNotification'
import { CHALLENGE_COLUMNS, LOCK_COLUMNS, type ChallengeRow, type LockRow } from '~/server/utils/challengeData'
import { evaluateEntry } from '~/utils/challenges'

// Called every few minutes by netlify/functions/lounge-tick.mts. Settles the
// open entries of every challenge: completed when the lock held to the finish,
// failed when it ended early or sat paused longer than the allowance. The
// wearer gets a push either way.
export default defineEventHandler(async (event) => {
  requireCronAuth(event)

  const supabase = useSupabaseAdmin()
  const { data: entries } = await supabase
    .from('challenge_entries')
    .select('challenge_id, user_id, loq_id, joined_at, completed_at, failed_at')
    .is('completed_at', null)
    .is('failed_at', null)
    .limit(5000)
  if (!entries?.length) return { completed: 0, failed: 0 }

  const challengeIds = [...new Set(entries.map(e => e.challenge_id as string))]
  const loqIds = [...new Set(entries.map(e => e.loq_id).filter((x): x is string => !!x))]
  const [{ data: challenges }, { data: locks }] = await Promise.all([
    supabase.from('challenges').select(CHALLENGE_COLUMNS).in('id', challengeIds),
    loqIds.length ? supabase.from('loqs').select(LOCK_COLUMNS).in('id', loqIds) : Promise.resolve({ data: [] }),
  ])
  const challengeBy = new Map((challenges as ChallengeRow[] ?? []).map(c => [c.id, c]))
  const lockBy = new Map((locks as LockRow[] ?? []).map(l => [l.id, l]))

  const now = Date.now()
  let completed = 0
  let failed = 0

  for (const e of entries) {
    const challenge = challengeBy.get(e.challenge_id)
    if (!challenge) continue
    const result = evaluateEntry(challenge, e, e.loq_id ? lockBy.get(e.loq_id) ?? null : null, now)
    if (result.status === 'active') continue

    const column = result.status === 'completed' ? 'completed_at' : 'failed_at'
    // Only the tick that flips the entry sends the push.
    const { data: flipped } = await supabase
      .from('challenge_entries')
      .update({ [column]: new Date(result.at ?? now).toISOString() })
      .eq('challenge_id', e.challenge_id)
      .eq('user_id', e.user_id)
      .is('completed_at', null)
      .is('failed_at', null)
      .select('user_id')
    if (!flipped?.length) continue

    if (result.status === 'completed') {
      completed++
      await sendPushNotification(e.user_id, `🏅 ${challenge.title}`, 'You made it. Challenge completed.', `/challenges/${challenge.slug}`)
    }
    else {
      failed++
      await sendPushNotification(e.user_id, challenge.title, 'The challenge is over for you: your lock ended early or stayed paused too long.', `/challenges/${challenge.slug}`)
    }
  }

  return { completed, failed }
})
