import type { H3Event } from 'h3'
import { useSupabaseAdmin } from './supabaseAdmin'
import type { AdminLevel, UserRole } from '~/types'
import { hasPremiumAccess } from '~/utils/access'

export async function requireAuth(event: H3Event) {
  const authHeader = getRequestHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const supabase = useSupabaseAdmin()
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7))

  if (error || !user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, status, is_admin, admin_level')
    .eq('id', user.id)
    .single<{ role: UserRole; status: string; is_admin: boolean; admin_level: AdminLevel | null }>()

  // TASK-127 — an access token issued before deletion stays valid until it
  // expires, so the check is here rather than only at login.
  if (!profile || profile.status !== 'active') {
    throw createError({
      statusCode: 403,
      message: profile?.status === 'deleted' ? 'This account was deleted' : 'Account suspended',
    })
  }

  return { user, role: profile.role, isAdmin: profile.is_admin, adminLevel: profile.admin_level }
}

/**
 * Enforces that the caller's admin_level is one of `levels`. Call right after
 * requireAuth(). A non-admin has adminLevel === null, so this also covers the
 * baseline "is an admin at all" check — there's no separate flat requireAdmin,
 * every admin route declares which level(s) it needs.
 */
export function requireAdminLevel(adminLevel: AdminLevel | null, levels: AdminLevel[]) {
  if (!adminLevel || !levels.includes(adminLevel)) {
    throw createError({ statusCode: 403, message: 'Insufficient admin permissions' })
  }
}

/**
 * Enforces the loqee subscription gate (TASK-056). Throws 402 unless the
 * user has premium access: an active subscription or a running free trial
 * (migration 079). Apply to loq-creating actions
 * (create / request a loqholder / publish) — never to lifecycle actions
 * (pause / end / cancel) or to an already-running loq, so cancelling a
 * subscription can't be used to shorten or trap a live loq.
 */
export async function requireActiveSubscription(
  userId: string,
  message = 'Active subscription required',
) {
  const supabase = useSupabaseAdmin()
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, trial_ends_at')
    .eq('id', userId)
    .single<{ subscription_status: string; trial_ends_at: string | null }>()

  if (!profile || !hasPremiumAccess(profile)) {
    throw createError({ statusCode: 402, message })
  }
}
