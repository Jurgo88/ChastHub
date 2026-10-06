import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireCronAuth } from '~/server/utils/cronAuth'
import { sendPushNotification } from '~/server/utils/sendPushNotification'
import { lockHours } from '~/server/utils/profileStats'
import { MILESTONE_COPY, reachedMilestones } from '~/server/utils/milestones'

// Called every few minutes by netlify/functions/lounge-tick.mts. Writes the
// milestones each running lock has reached, once, and tells the wearer about
// the newest one. Older ones found at the same time (first run on a long
// lock) are recorded as already seen, so nobody gets a wall of cards.
export default defineEventHandler(async (event) => {
  requireCronAuth(event)

  const supabase = useSupabaseAdmin()
  const { data: locks } = await supabase
    .from('loqs')
    .select('id, loqee_id, loqholder_id, status, created_at, accepted_at, loqed_until, ended_at, paused_at')
    .eq('status', 'active')
    .not('loqed_until', 'is', null)
    .limit(2000)

  let announced = 0
  for (const loq of locks ?? []) {
    const elapsed = lockHours(loq)
    const total = (new Date(loq.loqed_until!).getTime() - new Date(loq.created_at).getTime()) / 3_600_000
    const reached = reachedMilestones(elapsed, total)
    if (!reached.length) continue

    const { data: have } = await supabase.from('loq_milestones').select('key').eq('loq_id', loq.id)
    const known = new Set((have ?? []).map(r => r.key as string))
    const fresh = reached.filter(k => !known.has(k))
    if (!fresh.length) continue

    const now = new Date().toISOString()
    const latest = fresh[fresh.length - 1]!
    const { data: inserted } = await supabase
      .from('loq_milestones')
      .upsert(
        fresh.map(key => ({ loq_id: loq.id, key, reached_at: now, seen_at: key === latest ? null : now })),
        { onConflict: 'loq_id,key', ignoreDuplicates: true },
      )
      .select('key')
    // Another tick got there first for the newest one: nothing to announce.
    if (!inserted?.some(r => r.key === latest)) continue

    const copy = MILESTONE_COPY[latest]
    await sendPushNotification(loq.loqee_id, `🏆 ${copy.title}`, copy.text, '/dashboard')
    if (loq.loqholder_id) {
      await supabase.from('messages').insert({
        loq_id: loq.id,
        sender_id: loq.loqee_id,
        content: `🏆 Milestone: ${copy.title}`,
        loqee_id: loq.loqee_id,
        loqholder_id: loq.loqholder_id,
      })
      await sendPushNotification(loq.loqholder_id, `🏆 ${copy.title}`, 'Your wearer reached a milestone.', '/dashboard')
    }
    announced++
  }

  return { locks: locks?.length ?? 0, announced }
})
