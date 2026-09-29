import { randomUUID } from 'crypto'
import Stripe from 'stripe'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { logAudit } from '~/server/utils/auditLog'
import { DELETION_NOTE_MAX, DELETION_REASON_VALUES } from '~/utils/deletionReasons'

const AVATAR_BUCKET = 'avatars'

// TASK-127 — account deletion, and our answer to a GDPR erasure request.
//
// The profile row is anonymized rather than deleted: profiles.id is the
// auth.users id with ON DELETE CASCADE behind it, and loqs/messages hang off
// the profile, so dropping the row would delete the other party's history of
// a shared loq or conversation too. Everything personal is scrubbed; what is
// left is an unnamed tombstone the other side's history can still point at.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)

  // TASK-138 — why they are leaving. Validated before a single row is
  // touched: a rejected reason must not leave a half-deleted account behind.
  // The reason is required, the note is not.
  type DeleteBody = { reason?: unknown, note?: unknown }
  const body = await readBody<DeleteBody>(event).catch((): DeleteBody => ({}))
  const reason = typeof body?.reason === 'string' ? body.reason : ''
  const note = typeof body?.note === 'string' ? body.note.trim() : ''

  if (!DELETION_REASON_VALUES.includes(reason)) {
    throw createError({ statusCode: 400, message: 'Please choose a reason for leaving.' })
  }
  if (note.length > DELETION_NOTE_MAX) {
    throw createError({ statusCode: 400, message: `Keep the note under ${DELETION_NOTE_MAX} characters.` })
  }

  const supabase = useSupabaseAdmin()
  const now = new Date().toISOString()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, username, avatar_url, status, signup_country, signup_region, signup_timezone, signup_locale')
    .eq('id', user.id)
    .maybeSingle<{
      id: string
      email: string
      username: string | null
      avatar_url: string | null
      status: string
      signup_country: string | null
      signup_region: string | null
      signup_timezone: string | null
      signup_locale: string | null
    }>()

  if (!profile) throw createError({ statusCode: 404, message: 'Profile not found' })
  if (profile.status === 'deleted') return { deleted: true }

  // ── 1. End anything still running ────────────────────────────────────────
  // Their own loqs, and loqs they were holding the key to — the loqee on the
  // other side must not be left loqed by someone who no longer exists.
  const { data: ownLoqs } = await supabase
    .from('loqs')
    .update({ status: 'ended', locked: false, ended_at: now, paused_at: null })
    .eq('loqee_id', user.id)
    .in('status', ['draft', 'pending', 'active', 'paused'])
    .select('id')

  await supabase
    .from('loqs')
    .update({ status: 'ended', locked: false, ended_at: now, paused_at: null })
    .eq('loqholder_id', user.id)
    .in('status', ['active', 'paused'])

  // Requests they sent to loqholders (addressed by loq_id — loq_requests has
  // no loqee_id) and requests other loqholders sent to them.
  const endedLoqIds = (ownLoqs ?? []).map(l => l.id)
  if (endedLoqIds.length > 0) {
    await supabase
      .from('loq_requests')
      .update({ status: 'cancelled', responded_at: now })
      .in('loq_id', endedLoqIds)
      .eq('status', 'pending')
  }

  await supabase
    .from('loq_requests')
    .update({ status: 'cancelled', responded_at: now })
    .eq('loqholder_id', user.id)
    .eq('status', 'pending')

  // ── 2. Stop the billing ──────────────────────────────────────────────────
  // At period end, per the client's decision — they keep what they paid for.
  // A Stripe failure must not strand a half-deleted account, so it is logged
  // and the deletion continues.
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_subscription_id, status')
    .eq('user_id', user.id)
    .maybeSingle<{ stripe_subscription_id: string | null; status: string }>()

  let subscriptionCancelled = false
  if (sub?.stripe_subscription_id && sub.status === 'active') {
    try {
      const config = useRuntimeConfig(event)
      const stripe = new Stripe(config.stripeSecretKey)
      await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true })
      await supabase
        .from('subscriptions')
        .update({ cancel_at_period_end: true })
        .eq('user_id', user.id)
      subscriptionCancelled = true
    }
    catch (err) {
      console.error('[profile/delete] Stripe cancellation failed — cancel it manually:', err)
    }
  }

  // ── 3. Drop the uploaded avatar ──────────────────────────────────────────
  // Uploads live under <userId>/ in the avatars bucket (see useAvatar.ts);
  // listing the folder also catches earlier uploads the profile no longer
  // points at. Presets are local assets, nothing to delete.
  try {
    const { data: files } = await supabase.storage.from(AVATAR_BUCKET).list(user.id)
    if (files?.length) {
      await supabase.storage
        .from(AVATAR_BUCKET)
        .remove(files.map(f => `${user.id}/${f.name}`))
    }
  }
  catch (err) {
    console.error('[profile/delete] Avatar cleanup failed:', err)
  }

  // ── 4. Stop the notifications ────────────────────────────────────────────
  await supabase.from('push_subscriptions').delete().eq('user_id', user.id)

  // ── 5. Anonymize the profile ─────────────────────────────────────────────
  // username goes to NULL rather than a tombstone so the handle is released
  // and /user/<handle> stops resolving.
  const tombstoneEmail = `deleted+${randomUUID()}@deleted.chasthub.com`

  const { error: scrubError } = await supabase
    .from('profiles')
    .update({
      display_name: 'Deleted user',
      username: null,
      email: tombstoneEmail,
      avatar_url: null,
      bio: null,
      status: 'deleted',
      deleted_at: now,
      subscription_status: 'inactive',
      leaderboard_opt_out: true,
      show_online_status: false,
      last_seen_at: null,
      // TASK-137 — where they signed up from is personal data and goes with
      // the rest of it. Leaving it would keep a location on a row whose whole
      // point is that it no longer identifies anyone.
      signup_country: null,
      signup_region: null,
      signup_timezone: null,
      signup_locale: null,
    })
    .eq('id', user.id)

  if (scrubError) {
    console.error('[profile/delete] Profile anonymization failed:', scrubError)
    throw createError({ statusCode: 500, message: 'Failed to delete the account. Nothing was changed, please try again.' })
  }

  // ── 6. Close the door on the auth side ───────────────────────────────────
  // The address must go too (it is personal data, and leaving it would block
  // signing up again with it), and a random password invalidates the
  // credentials they had. Any access token already issued stays valid until
  // it expires, which requireAuth now rejects on `status = 'deleted'`.
  const { error: authError } = await supabase.auth.admin.updateUserById(user.id, {
    email: tombstoneEmail,
    password: randomUUID() + randomUUID(),
    email_confirm: true,
    user_metadata: {},
  })

  if (authError) {
    console.error('[profile/delete] auth.users scrub failed — profile is already anonymized:', authError.message)
  }

  // TASK-138 — the client asked to keep the address of anyone who leaves, so
  // it is recorded here rather than on the profile. It deliberately does NOT
  // stay on auth.users: that column is unique, and leaving the real address
  // there is exactly what would stop the same person signing up again
  // (signup.post.ts turns the collision into a 409). The tombstone above frees
  // the address; this row remembers who it belonged to.
  //
  // TASK-141 — where they signed up from, for the same reason and on the
  // same terms as the address. The profile copy is still scrubbed above, so
  // the tombstone gives nothing away; this is the one super_admin-only place
  // it survives, and without it "which countries are we losing people in" is
  // unanswerable — the users table shows a deleted row as having no origin at
  // all, which is what prompted this.
  //
  // /api/admin/deletions reads it back, super_admin only.
  await logAudit(supabase, 'account_deleted', user.id, user.id, {
    email: profile.email,
    reason,
    note: note || null,
    subscription_cancelled: subscriptionCancelled,
    signup_country: profile.signup_country,
    signup_region: profile.signup_region,
    signup_timezone: profile.signup_timezone,
    signup_locale: profile.signup_locale,
  })

  return { deleted: true, subscription_cancelled: subscriptionCancelled }
})
