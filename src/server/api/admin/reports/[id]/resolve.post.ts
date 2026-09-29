import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAdminLevel, requireAuth } from '~/server/utils/auth'
import { banUser } from '~/server/utils/banUser'

export default defineEventHandler(async (event) => {
  const { user: adminUser, adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['support', 'super_admin'])

  const reportId = getRouterParam(event, 'id')
  if (!reportId) throw createError({ statusCode: 400, message: 'Report ID required' })

  const body = await readBody<{ action: 'dismiss' | 'ban'; reason?: string }>(event)
  const { action, reason } = body ?? {}

  if (!action || !['dismiss', 'ban'].includes(action)) {
    throw createError({ statusCode: 400, message: 'action must be "dismiss" or "ban"' })
  }

  const supabase = useSupabaseAdmin()

  const { data: report } = await supabase
    .from('reports')
    .select('id, reported_user_id, status')
    .eq('id', reportId)
    .maybeSingle<{ id: string; reported_user_id: string; status: string }>()

  if (!report) throw createError({ statusCode: 404, message: 'Report not found' })
  if (report.status !== 'open') throw createError({ statusCode: 409, message: 'Report is already resolved' })

  if (action === 'ban') {
    const { data: target } = await supabase
      .from('profiles')
      .select('status, is_admin')
      .eq('id', report.reported_user_id)
      .maybeSingle<{ status: string; is_admin: boolean }>()

    if (target && target.status !== 'banned' && !target.is_admin) {
      await banUser(supabase, adminUser.id, report.reported_user_id, {
        reason: reason ?? null,
        report_id: reportId,
      })
    }
  }

  await supabase
    .from('reports')
    .update({
      status: action === 'ban' ? 'resolved' : 'dismissed',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', reportId)

  await supabase.from('audit_log').insert({
    action: action === 'ban' ? 'report_resolved' : 'report_dismissed',
    actor_id: adminUser.id,
    details: { report_id: reportId, reason: reason ?? null },
  })

  return { success: true }
})
