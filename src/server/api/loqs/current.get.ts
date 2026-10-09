import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { maybeExpireLoq } from '~/server/utils/expireLoq'
import { getVisitorCount } from '~/server/utils/getVisitorCount'
import { loadLockSignals } from '~/server/utils/lockSignals'

export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqee') throw createError({ statusCode: 403, message: 'Only wearers can access their current lock' })

  const supabase = useSupabaseAdmin()

  let { data: loq } = await supabase
    .from('loqs')
    .select('*')
    .eq('loqee_id', user.id)
    .in('status', ['draft', 'pending', 'active', 'paused'])
    .maybeSingle()

  if (loq) {
    // Lazy expiry: if this request is the one that discovers the loq just
    // ran out, maybeExpireLoq() persists status='ended' — reflect that
    // locally instead of returning null, so this same response can carry
    // the reveal data below (TASK-084) rather than forcing a second round trip.
    if (await maybeExpireLoq(supabase, loq)) {
      loq = { ...loq, status: 'ended', locked: false }
    }
  }
  else {
    // No in-flight loq — check for the most recent ended/cancelled loq
    // whose combination hasn't been shown to the loqee yet (TASK-084).
    // Without this, cancelling (or a loq expiring while the tab is closed)
    // permanently loses the one piece of data the loqee actually needs:
    // the combination to open their physical lock.
    const { data: recent } = await supabase
      .from('loqs')
      .select('*')
      .eq('loqee_id', user.id)
      .in('status', ['ended', 'cancelled'])
      .is('combination_revealed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    loq = recent
  }

  if (!loq) return null

  const { count: pendingRequests } = await supabase
    .from('loq_requests')
    .select('id', { count: 'exact', head: true })
    .eq('loq_id', loq.id)
    .eq('status', 'pending')

  // TASK-087 — on a public loq, the pending request is a loqholder asking
  // to join (the reverse of the private-pairing direction below) — the
  // loqee needs to see who, to approve/reject them.
  let pendingRequest: { id: string; loqholder: { id: string; display_name: string | null; avatar_url: string | null } } | null = null
  if (loq.is_public && pendingRequests) {
    const { data: req } = await supabase
      .from('loq_requests')
      .select('id, loqholder:profiles!loqholder_id(id, display_name, avatar_url)')
      .eq('loq_id', loq.id)
      .eq('status', 'pending')
      .maybeSingle()
    if (req) {
      const loqholderProfile = Array.isArray(req.loqholder) ? req.loqholder[0] : req.loqholder
      pendingRequest = loqholderProfile ? { id: req.id, loqholder: loqholderProfile } : null
    }
  }

  const shouldHide = ['active', 'paused', 'pending', 'draft'].includes(loq.status)

  let loqholder: { id: string; display_name: string | null; avatar_url: string | null; last_seen_at: string | null } | null = null
  if (loq.loqholder_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, last_seen_at, show_online_status')
      .eq('id', loq.loqholder_id)
      .single()
    loqholder = profile
      ? { id: profile.id, display_name: profile.display_name, avatar_url: profile.avatar_url, last_seen_at: profile.show_online_status ? profile.last_seen_at : null }
      : null
  }

  let combination_photo_url: string | null = null
  if (!shouldHide && loq.combination_photo_url) {
    const { data } = await supabase.storage
      .from('combination-photos')
      .createSignedUrl(loq.combination_photo_url, 3600)
    combination_photo_url = data?.signedUrl ?? null
  }

  // Once a loqholder is attached, the visitor link is theirs to control
  // (TASK-063) — the loqee's own client never even receives it.
  const hideVisitorLink = !!loq.loqholder_id

  // TASK-090 — only meaningful once there's a link to have visitors at all.
  const visitorCount = hideVisitorLink || !loq.public_link_id ? 0 : await getVisitorCount(supabase, loq.id)

  // Issue #24 — the wearer's "Next up" and "Today", only while it runs.
  const signals = ['active', 'paused'].includes(loq.status)
    ? (await loadLockSignals(supabase, [loq])).get(loq.id)
    : undefined

  return {
    ...loq,
    ...signals,
    combination_text: shouldHide ? null : loq.combination_text,
    combination_photo_url,
    pending_requests: pendingRequests ?? 0,
    pending_request: pendingRequest,
    loqholder,
    public_link_id: hideVisitorLink ? null : loq.public_link_id,
    visitor_count: visitorCount,
  }
})
