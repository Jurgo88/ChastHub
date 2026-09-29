import { requireAuth } from '~/server/utils/auth'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { isLoungeModerator } from '~/server/utils/lounge'
import { logAudit } from '~/server/utils/auditLog'

export default defineEventHandler(async (event) => {
  const { user, adminLevel } = await requireAuth(event)
  if (!isLoungeModerator(adminLevel)) throw createError({ statusCode: 403, message: 'Not allowed' })
  const target = getRouterParam(event, 'userId')
  if (!target) throw createError({ statusCode: 400, message: 'userId required' })

  const supabase = useSupabaseAdmin()
  await supabase.from('lounge_mutes').delete().eq('user_id', target)
  await logAudit(supabase, 'lounge_unmute', user.id, target, {})
  return { ok: true }
})
