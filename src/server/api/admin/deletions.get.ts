import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAdminLevel, requireAuth } from '~/server/utils/auth'

// TASK-138 — who deleted their account, when, and why.
//
// Deletion anonymizes the profile (TASK-127), so `profiles` cannot answer any
// of this: the row that is left has a tombstone address and no reason on it.
// The `account_deleted` audit entry is the only place the real address and the
// reason survive, which is why this reads audit_log rather than the user
// listing.
//
// super_admin only, and deliberately not folded into /api/admin/users, which
// support and analysts can read — the whole point of the anonymization is that
// those addresses are not routine admin furniture.

// A capped scan for the breakdown: counting reasons has to look past the
// current page, and PostgREST cannot GROUP BY, so the rows are tallied here.
// The cap bounds what one page load can pull; past it the breakdown stops
// being exact, and the response says so rather than quietly undercounting.
// Worth an RPC doing the GROUP BY in Postgres if deletions ever reach it.
const BREAKDOWN_CAP = 10000

interface DeletionRow {
  id: string
  target_id: string | null
  created_at: string
  details: {
    email?: string
    reason?: string
    note?: string | null
    subscription_cancelled?: boolean
    signup_country?: string | null
    signup_region?: string | null
    signup_timezone?: string | null
    signup_locale?: string | null
  } | null
}

export default defineEventHandler(async (event) => {
  const { adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['super_admin'])

  const supabase = useSupabaseAdmin()
  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 50, 100)
  const offset = Number(query.offset) || 0
  const ascending = query.dir === 'asc'

  const [page, breakdown] = await Promise.all([
    supabase
      .from('audit_log')
      .select('id, target_id, created_at, details', { count: 'exact' })
      .eq('action', 'account_deleted')
      .order('created_at', { ascending })
      .range(offset, offset + limit - 1),
    supabase
      .from('audit_log')
      .select('details')
      .eq('action', 'account_deleted')
      .order('created_at', { ascending: false })
      .limit(BREAKDOWN_CAP),
  ])

  if (page.error || breakdown.error) {
    console.error('[admin/deletions]', page.error?.message ?? breakdown.error?.message)
    throw createError({ statusCode: 500, message: 'Failed to fetch deletions' })
  }

  const counts = new Map<string, number>()
  for (const row of (breakdown.data ?? []) as { details: { reason?: string } | null }[]) {
    // Deletions from before TASK-138 have no reason on them at all.
    const reason = row.details?.reason ?? 'unknown'
    counts.set(reason, (counts.get(reason) ?? 0) + 1)
  }

  const deletions = ((page.data ?? []) as DeletionRow[]).map(row => ({
    id: row.id,
    user_id: row.target_id,
    deleted_at: row.created_at,
    email: row.details?.email ?? null,
    reason: row.details?.reason ?? null,
    note: row.details?.note ?? null,
    subscription_cancelled: row.details?.subscription_cancelled ?? false,
    // TASK-141 — the profile's copy is scrubbed on deletion, so this entry is
    // the only place a deleted account's origin still exists. Absent on any
    // deletion recorded before this shipped, and on accounts that predate the
    // origin being captured at all.
    signup_country: row.details?.signup_country ?? null,
    signup_region: row.details?.signup_region ?? null,
    signup_timezone: row.details?.signup_timezone ?? null,
    signup_locale: row.details?.signup_locale ?? null,
  }))

  return {
    deletions,
    total: page.count ?? 0,
    breakdown: [...counts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    breakdown_capped: (breakdown.data?.length ?? 0) >= BREAKDOWN_CAP,
  }
})
