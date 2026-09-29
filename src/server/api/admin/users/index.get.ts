import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAdminLevel, requireAuth } from '~/server/utils/auth'

// Anything that reaches .order() or .in() has to come off an allowlist — these
// go into the query unquoted.
const SORTABLE = ['created_at']
const ROLES = ['loqee', 'loqholder']
const STATUSES = ['active', 'banned', 'deleted']
const BILLING = ['active', 'cancelling', 'past_due', 'lapsed', 'none']

// An absent or fully-invalid list means "no filter", not "match nothing", so
// clearing every checkbox widens the listing instead of emptying it.
function pickList(raw: unknown, allowed: string[]): string[] {
  if (typeof raw !== 'string' || !raw) return []
  return raw.split(',').map(v => v.trim()).filter(v => allowed.includes(v))
}

export default defineEventHandler(async (event) => {
  const { adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['support', 'super_admin'])

  const supabase = useSupabaseAdmin()
  const query = getQuery(event)
  const search = (query.search as string | undefined)?.trim() ?? ''
  const roles = pickList(query.role, ROLES)
  const statuses = pickList(query.status, STATUSES)
  const billing = pickList(query.billing, BILLING)
  const sort = SORTABLE.includes(query.sort as string) ? (query.sort as string) : 'created_at'
  const ascending = query.dir === 'asc'
  const limit = Math.min(Number(query.limit) || 50, 100)
  const offset = Number(query.offset) || 0

  // admin_user_listing (migration 055) is profiles left-joined onto
  // subscriptions, so billing_status filters and the exact count come out of
  // the same query as everything else.
  let q = supabase
    .from('admin_user_listing')
    .select(
      'id, email, username, display_name, avatar_url, role, is_admin, status, '
      + 'deleted_at, created_at, billing_status, cancel_at_period_end, current_period_end, '
      + 'signup_country, signup_region, signup_timezone, signup_locale',
      { count: 'exact' },
    )
    .order(sort, { ascending })
    .range(offset, offset + limit - 1)

  // One box matches email, handle and display name. A leading "@" is how
  // handles are shown everywhere else, so it is dropped rather than searched.
  // The term goes into a PostgREST or() filter, where , . : ( ) are syntax —
  // quoting the value (with " and \ escaped) keeps them literal.
  const term = search.replace(/^@/, '')
  if (term) {
    const quoted = `"%${term.replace(/[\\"]/g, '\\$&')}%"`
    q = q.or(`email.ilike.${quoted},username.ilike.${quoted},display_name.ilike.${quoted}`)
  }
  if (roles.length) q = q.in('role', roles)
  if (statuses.length) q = q.in('status', statuses)
  if (billing.length) q = q.in('billing_status', billing)

  const { data: users, count, error } = await q

  if (error) throw createError({ statusCode: 500, message: 'Failed to fetch users' })

  return { users, total: count ?? 0 }
})
