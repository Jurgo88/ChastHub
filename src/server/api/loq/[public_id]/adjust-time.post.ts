import { postLoungeEvent } from '~/server/utils/lounge'
import { createHash } from 'crypto'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { broadcastLoqUpdate } from '~/server/utils/broadcastLoq'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { sendPushNotification } from '~/server/utils/sendPushNotification'
import { MAX_DURATION_MINUTES } from '~/server/utils/loqValidation'
import { getClientIp } from '~/server/utils/clientIp'

const MAX_DURATION_MS = MAX_DURATION_MINUTES * 60_000 // TASK-085
// One push per loq per minute — several different visitors acting in a
// burst shouldn't each fire a separate push at the owner.
const PUSH_COOLDOWN_MS = 60_000

export default defineEventHandler(async (event) => {
  const publicId = getRouterParam(event, 'public_id')
  if (!publicId) throw createError({ statusCode: 400, message: 'Missing public_id' })

  const body = await readBody<{ direction?: 'add' | 'remove' }>(event).catch(() => ({}))
  const direction = body?.direction === 'remove' ? 'remove' : 'add'

  // TASK-144 — this used to be getRequestIP(event) ?? 'unknown', which on
  // Netlify was 'unknown' for everybody: the first visitor to vote on a loq
  // locked out every other visitor for an hour.
  const visitorIp = getClientIp(event)
  const ipHash = visitorIp
    ? createHash('sha256').update(visitorIp).digest('hex').slice(0, 32)
    : null
  const supabase = useSupabaseAdmin()

  // TASK-142 — this endpoint stays open to anonymous visitors (the share
  // link is the whole point), but now that loqs are browsable in-app most
  // callers are signed in. Identify them when we can: one-per-IP-per-hour
  // was proportionate for a link passed between people, and is not for a
  // list anyone can scroll with a phone that hands out fresh IPs on demand.
  let voterId: string | null = null
  const authHeader = getRequestHeader(event, 'authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const { data: { user: voter } } = await supabase.auth.getUser(authHeader.slice(7))
    voterId = voter?.id ?? null
  }

  const { data: loq, error: loqError } = await supabase
    .from('loqs')
    .select('id, loqed_until, status, visitor_add_hours, visitor_permission, public_link_id, loqee_id, loqholder_id')
    .eq('public_link_id', publicId)
    .single()

  if (loqError || !loq) {
    throw createError({ statusCode: 404, message: 'Lock not found' })
  }

  // TASK-146 — 'pending' belongs here. The clock starts at creation
  // (TASK-062), so a loq published to find a loqholder is already running and
  // is listed in Discover; expireLoq treats draft/pending as live for exactly
  // that reason, and the public loq page only turns away ended/cancelled.
  // This allow-list predates all of that, from when only an accepted loq had
  // a shareable link — so every vote on a listed-but-unaccepted loq answered
  // "This loq has ended" while its countdown ticked on screen.
  if (!['pending', 'active', 'paused'].includes(loq.status)) {
    throw createError({ statusCode: 410, message: 'This lock has ended' })
  }

  // TASK-142 — the owner acting on their own loq would be voting on
  // themselves. Checked before the rate-limit lookup so it always fails for
  // the same reason, whatever the voting history looks like.
  if (voterId && voterId === loq.loqee_id) {
    throw createError({ statusCode: 403, message: "You can't vote on your own lock" })
  }

  // TASK-142 — the owner listed this loq but did not open the clock.
  if (loq.visitor_permission === 'none') {
    throw createError({ statusCode: 403, message: 'This lock is not accepting time changes' })
  }

  // TASK-089 — the owner may have restricted visitors to only adding or
  // only removing time. Enforced server-side, not just hidden in the UI.
  if (loq.visitor_permission !== 'both' && loq.visitor_permission !== direction) {
    throw createError({ statusCode: 403, message: `Visitors can only ${loq.visitor_permission} time on this lock` })
  }

  const oneHourAgo = new Date(Date.now() - 3_600_000)

  // A signed-in voter is limited by account, so switching networks does not
  // buy another vote. Anonymous visitors fall back to the IP hash.
  //
  // TASK-144 — with neither, there is nothing to limit on. Letting the vote
  // through is the lesser failure: bucketing every anonymous caller together
  // is what broke this in the first place, and it turns one person's vote
  // into an hour-long outage for everyone else on that loq.
  const identity = voterId
    ? { column: 'user_id', value: voterId }
    : ipHash ? { column: 'ip_hash', value: ipHash } : null

  if (!identity) {
    console.warn('[adjust-time] No client address and no session — skipping the rate limit')
  }

  if (identity) {
    const { data: existing } = await supabase
      .from('loq_visitor_interactions')
      .select('created_at')
      .eq('loq_id', loq.id)
      .gt('created_at', oneHourAgo.toISOString())
      .eq(identity.column, identity.value)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      throw createError({ statusCode: 429, message: 'Come back in an hour to change the time again!' })
    }
  }

  const magnitude = loq.visitor_add_hours ?? 1
  const deltaHours = direction === 'remove' ? -magnitude : magnitude
  const now = new Date()
  const minUntil = now.toISOString()
  const maxUntil = new Date(now.getTime() + MAX_DURATION_MS).toISOString()

  const { data: newLoqedUntil, error: updateError } = await supabase.rpc('adjust_visitor_time', {
    p_loq_id: loq.id,
    p_delta_hours: deltaHours,
    p_min_until: minUntil,
    p_max_until: maxUntil,
  })

  if (updateError || !newLoqedUntil) {
    console.error('[adjust-time] Failed to update loq:', updateError)
    throw createError({ statusCode: 500, message: 'Failed to adjust time' })
  }

  await supabase.from('loq_visitor_interactions').insert({
    loq_id: loq.id,
    public_link_id: loq.public_link_id,
    // NOT NULL in the schema; the sentinel is only ever written, never
    // matched against, so it cannot bucket anyone together.
    ip_hash: ipHash ?? 'unknown',
    user_id: voterId,
    hours_added: magnitude,
    direction,
    loqee_id: loq.loqee_id,
    loqholder_id: loq.loqholder_id,
  })

  // Drive-by fix: same Netlify-Lambda-freeze issue TASK-083 fixed for
  // sendPushNotification — was fire-and-forget, could get frozen mid-flight.
  await broadcastLoqUpdate(loq.id, { loq: { id: loq.id, loqed_until: newLoqedUntil } })

  // Client-side postgres_changes subscription (loqee.vue / loqholder.vue)
  // handles the in-app toast; push is the only thing that needs doing here.
  // Cooldown so a burst of different visitors doesn't fire one push each.
  if (await checkRateLimit(`visitor-push:${loq.id}`, 1, PUSH_COOLDOWN_MS)) {
    const verb = direction === 'remove' ? 'removed' : 'added'
    const message = `A visitor ${verb} ${magnitude}h ${direction === 'remove' ? 'from' : 'to'} the lock.`
    // TASK-148 — this was /loqs/<id>, which is not a route in this app
    // (pages are /loq/[public_id] and /dashboard/*), so tapping the
    // notification landed on the 404 page. /dashboard redirects by role.
    const pushUrl = '/dashboard'
    await sendPushNotification(loq.loqee_id, 'Lock time changed', message, pushUrl)
    if (loq.loqholder_id) {
      await sendPushNotification(loq.loqholder_id, 'Lock time changed', message, pushUrl)
    }
  }

  await postLoungeEvent(
    direction === 'remove'
      ? `⏱ A visitor took ${magnitude}h off a Key Drop lock`
      : `⏱ A visitor added +${magnitude}h to a Key Drop lock`,
    'keydrop',
  )

  return {
    // TASK-147 — the share page knows only the public link id, and the
    // Discover feed is keyed by loq id, so it has to come back from here.
    loq_id: loq.id,
    new_loqed_until: newLoqedUntil as string,
    hours_changed: magnitude,
    direction,
  }
})
