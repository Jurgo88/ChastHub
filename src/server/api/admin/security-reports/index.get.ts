import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAdminLevel, requireAuth } from '~/server/utils/auth'

// TASK-168 — reports sent through the public form (/report, /security).
// super_admin only: each row carries the sender's IP and user agent.
// TASK-173 — the form now takes bugs too; `kind` filters, and the open
// security count is returned on its own so those never get lost.
const KINDS = ['bug', 'security', 'other']
// TASK-177 — reports sent while deleting an account carry the reason for
// leaving and the reporter.
const SOURCES = ['form', 'account_deletion']
export default defineEventHandler(async (event) => {
  const { adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['super_admin'])

  const supabase = useSupabaseAdmin()
  const query = getQuery(event)
  const status = ['open', 'handled', 'all'].includes(query.status as string) ? query.status as string : 'open'
  const limit = Math.min(Number(query.limit) || 50, 100)
  const offset = Math.max(Number(query.offset) || 0, 0)
  const kind = KINDS.includes(query.kind as string) ? query.kind as string : null
  const source = SOURCES.includes(query.source as string) ? query.source as string : null

  let q = supabase
    .from('security_reports')
    .select(
      'id, kind, source, source_detail, created_at, message, contact, user_agent, ip, handled_at, admin_note, '
      + 'handled_by_profile:profiles!handled_by(id, display_name, email), '
      + 'reporter:profiles!reporter_id(id, display_name, email, status)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status === 'open') q = q.is('handled_at', null)
  if (status === 'handled') q = q.not('handled_at', 'is', null)
  if (kind) q = q.eq('kind', kind)
  if (source) q = q.eq('source', source)

  const [{ data: reports, count, error }, open, openSecurity] = await Promise.all([
    q,
    supabase.from('security_reports').select('id', { count: 'exact', head: true }).is('handled_at', null),
    supabase.from('security_reports').select('id', { count: 'exact', head: true }).is('handled_at', null).eq('kind', 'security'),
  ])

  if (error) throw createError({ statusCode: 500, message: 'Failed to fetch security reports' })

  return { reports, total: count ?? 0, open: open.count ?? 0, open_security: openSecurity.count ?? 0 }
})
