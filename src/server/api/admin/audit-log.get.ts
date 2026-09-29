import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAdminLevel, requireAuth } from '~/server/utils/auth'
import { AUDIT_ACTIONS } from '~/utils/auditActions'

// TASK-169 — the audit trail. super_admin only, matching the RLS policy on
// audit_log (060): entries name who banned, demoted or deleted whom.
//
// Actions reach .in() unquoted, so they come off the shared allow-list (the
// same rule as admin/users). An entry whose action is not on it still shows
// under "all"; the list only bounds what can be filtered on.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const { adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['super_admin'])

  const query = getQuery(event)
  const actions = typeof query.actions === 'string' && query.actions
    ? query.actions.split(',').map(a => a.trim()).filter(a => AUDIT_ACTIONS.includes(a))
    : []
  const user = typeof query.user === 'string' && UUID.test(query.user) ? query.user : null
  const limit = Math.min(Number(query.limit) || 50, 100)
  const offset = Math.max(Number(query.offset) || 0, 0)

  const supabase = useSupabaseAdmin()
  let q = supabase
    .from('audit_log')
    .select(
      'id, action, details, created_at, '
      + 'actor:profiles!actor_id(id, display_name, email), '
      + 'target:profiles!target_id(id, display_name, email)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (actions.length) q = q.in('action', actions)
  // The user acted, or was acted on. `user` is a validated UUID, so it is
  // safe inside the or() filter.
  if (user) q = q.or(`actor_id.eq.${user},target_id.eq.${user}`)

  const { data: entries, count, error } = await q
  if (error) throw createError({ statusCode: 500, message: 'Failed to fetch audit log' })

  return { entries, total: count ?? 0 }
})
