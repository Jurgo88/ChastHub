import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAdminLevel, requireAuth } from '~/server/utils/auth'

// TASK-160 — product KPIs (DAU, retention, loq funnel, new subscribers,
// sessions, countries). TASK-182 — every admin level that can open the
// dashboard sees them, by the owner's decision. They are aggregates, not
// anyone's personal data. Revenue (/api/admin/revenue) stays super_admin only.
//
// All of it is computed by admin_kpi() (migration 001) in one call; this
// handler only gates and forwards. TASK-165 adds admin_signup_sources() (068)
// alongside it.
export default defineEventHandler(async (event) => {
  const { adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['analyst', 'support', 'super_admin'])

  const supabase = useSupabaseAdmin()
  const [{ data, error }, sources] = await Promise.all([
    supabase.rpc('admin_kpi'),
    supabase.rpc('admin_signup_sources'),
  ])

  if (error) {
    console.error('[admin/kpi]', error.message)
    // The likeliest cause right after a deploy — say so rather than a bare 500.
    const missing = /admin_kpi|function .* does not exist|PGRST202/i.test(`${error.code} ${error.message}`)
    throw createError({
      statusCode: 500,
      message: missing ? 'KPIs are not set up yet. Apply migration 001.' : 'Failed to fetch KPIs',
    })
  }

  // A missing or failing sources function hides one block, never the panel.
  if (sources.error) console.error('[admin/kpi] admin_signup_sources', sources.error.message)

  return { ...data, sources: sources.error ? null : sources.data }
})
