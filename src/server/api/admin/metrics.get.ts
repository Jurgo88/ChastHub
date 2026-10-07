import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAdminLevel, requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const { adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['analyst', 'support', 'super_admin'])

  const supabase = useSupabaseAdmin()

  const now = Date.now()
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Admins and test accounts (@test.sk, @chasthub.sk: profiles.is_test_account,
  // migration 017) are not users for statistics purposes.
  const real = () => supabase.from('profiles').select('id', { count: 'exact', head: true })
    .eq('is_admin', false).eq('is_test_account', false)

  const count = (query: PromiseLike<{ count: number | null }>) => query.then(r => r.count ?? 0)

  const [
    loqeeCount,
    loqholderCount,
    signups7d,
    signups30d,
    activeLoqs,
    openReports,
    activeSubscriptions,
  ] = await Promise.all([
    count(real().eq('role', 'loqee')),
    count(real().eq('role', 'loqholder')),
    count(real().gte('created_at', since7d)),
    count(real().gte('created_at', since30d)),
    count(supabase.from('loqs').select('id', { count: 'exact', head: true }).eq('status', 'active')),
    count(supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open')),
    count(supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active')),
  ])

  return {
    users: { loqee: loqeeCount, loqholder: loqholderCount, total: loqeeCount + loqholderCount },
    signups: { last_7d: signups7d, last_30d: signups30d },
    active_loqs: activeLoqs,
    open_reports: openReports,
    active_subscriptions: activeSubscriptions,
  }
})
