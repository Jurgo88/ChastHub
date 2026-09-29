import { requireAdminLevel, requireAuth } from '~/server/utils/auth'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { getLoungeSettings, getLoungeStatus } from '~/server/utils/lounge'

export default defineEventHandler(async (event) => {
  const { adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['support', 'super_admin'])
  const supabase = useSupabaseAdmin()

  const settings = await getLoungeSettings()
  const [status, { data: questions }, { data: mutes }] = await Promise.all([
    getLoungeStatus(Date.now(), settings),
    supabase.from('lounge_questions').select('day, text').order('day'),
    supabase
      .from('lounge_mutes')
      .select('user_id, muted_until, reason, created_at, user:profiles!user_id(display_name, username, email)')
      .gt('muted_until', new Date().toISOString())
      .order('muted_until', { ascending: false }),
  ])

  return { settings, status, questions: questions ?? [], mutes: mutes ?? [] }
})
