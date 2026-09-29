import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAdminLevel, requireAuth } from '~/server/utils/auth'

// user_activity_days.day is a Europe/Bratislava calendar day (065).
function bratislavaDay(d: Date) {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Bratislava' })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The admin view of one user. Looked up by id rather than username: username
// is optional (nothing sets it at signup) and a banned or deleted profile is
// unreachable through /api/profiles/[username] anyway.
export default defineEventHandler(async (event) => {
  const { adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['support', 'super_admin'])

  const id = getRouterParam(event, 'id')
  // A malformed id would reach Postgres as a uuid cast and come back a 500.
  if (!id || !UUID.test(id)) throw createError({ statusCode: 404, message: 'User not found' })

  const supabase = useSupabaseAdmin()

  const [listing, profile, asLoqee, asLoqholder, activeLoqs, ban, activity, trackingSince] = await Promise.all([
    supabase
      .from('admin_user_listing')
      .select(
        'id, email, username, display_name, avatar_url, role, is_admin, status, '
        + 'deleted_at, created_at, billing_status, cancel_at_period_end, current_period_end, '
        + 'signup_country, signup_region, signup_timezone, signup_locale',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('bio, admin_level, last_seen_at, leaderboard_opt_out, terms_accepted_at')
      .eq('id', id)
      .maybeSingle(),
    supabase.from('loqs').select('id', { count: 'exact', head: true }).eq('loqee_id', id),
    supabase.from('loqs').select('id', { count: 'exact', head: true }).eq('loqholder_id', id),
    supabase
      .from('loqs')
      .select('id', { count: 'exact', head: true })
      .or(`loqee_id.eq.${id},loqholder_id.eq.${id}`)
      .in('status', ['active', 'paused']),
    // Only the latest ban matters — an unban after it clears it (see below).
    supabase
      .from('audit_log')
      .select('action, details, created_at')
      .eq('target_id', id)
      .in('action', ['user_banned', 'user_unbanned'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // TASK-171 — the last 30 days, today included.
    supabase
      .from('user_activity_days')
      .select('day, sessions, heartbeats')
      .eq('user_id', id)
      .gte('day', bratislavaDay(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)))
      .order('day'),
    // When tracking began at all, so "no activity" can be told apart from
    // "not tracked yet".
    supabase.from('user_activity_days').select('day').order('day').limit(1).maybeSingle(),
  ])

  if (listing.error || profile.error) {
    throw createError({ statusCode: 500, message: 'Failed to fetch user' })
  }
  if (!listing.data) throw createError({ statusCode: 404, message: 'User not found' })

  // Activity is extra: a missing table (migration 001 not applied) or any
  // other failure here leaves the rest of the page intact.
  if (activity.error) console.error('[admin/users/:id] activity', activity.error.message)

  const lastBan = ban.data?.action === 'user_banned' ? ban.data : null

  return {
    ...listing.data,
    ...profile.data,
    loqs_as_loqee: asLoqee.count ?? 0,
    loqs_as_loqholder: asLoqholder.count ?? 0,
    loqs_active: activeLoqs.count ?? 0,
    ban: listing.data.status === 'banned' && lastBan
      ? { at: lastBan.created_at, reason: (lastBan.details as { reason?: string | null } | null)?.reason ?? null }
      : null,
    activity_30d: activity.error ? null : (activity.data ?? []),
    activity_tracking_since: (trackingSince.data as { day: string } | null)?.day ?? null,
  }
})
