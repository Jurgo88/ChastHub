import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAdminLevel, requireAuth } from '~/server/utils/auth'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// TASK-168 — mark a vulnerability report handled (with an optional note on
// what was done) or reopen it.
export default defineEventHandler(async (event) => {
  const { user: adminUser, adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['super_admin'])

  const id = getRouterParam(event, 'id')
  if (!id || !UUID.test(id)) throw createError({ statusCode: 404, message: 'Report not found' })

  const body = await readBody<{ handled?: unknown; note?: unknown }>(event)
  if (typeof body?.handled !== 'boolean') throw createError({ statusCode: 400, message: 'handled must be boolean' })
  if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') {
    throw createError({ statusCode: 400, message: 'note must be a string' })
  }
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) || null : null

  const supabase = useSupabaseAdmin()

  const update = body.handled
    ? { handled_at: new Date().toISOString(), handled_by: adminUser.id, admin_note: note }
    // Reopening clears who/when, but keeps the note: it is the history of
    // what was tried.
    : { handled_at: null, handled_by: null }

  const { data, error } = await supabase
    .from('security_reports')
    .update(update)
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, message: 'Failed to update report' })
  if (!data) throw createError({ statusCode: 404, message: 'Report not found' })

  // target_id references profiles, and a report is not one — the id goes in
  // details instead.
  const { error: auditError } = await supabase.from('audit_log').insert({
    action: body.handled ? 'security_report_handled' : 'security_report_reopened',
    actor_id: adminUser.id,
    details: { security_report_id: id, note },
  })
  if (auditError) console.error('[security-reports] audit insert failed:', auditError)

  return { success: true }
})
