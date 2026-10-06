import { requireAdminLevel, requireAuth } from '~/server/utils/auth'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { logAudit } from '~/server/utils/auditLog'

// PATCH /api/admin/challenges/<id> { active }: close or reopen a challenge.
// Entries stay as they are; a closed challenge just leaves the public list.
export default defineEventHandler(async (event) => {
  const { user, adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['support', 'super_admin'])

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Challenge required' })

  const body = await readBody<{ active?: unknown }>(event)
  if (typeof body?.active !== 'boolean') throw createError({ statusCode: 400, message: 'active must be true or false' })

  const supabase = useSupabaseAdmin()
  const { data } = await supabase.from('challenges').update({ active: body.active }).eq('id', id).select('id').maybeSingle()
  if (!data) throw createError({ statusCode: 404, message: 'Challenge not found' })

  await logAudit(supabase, 'challenge_updated', user.id, user.id, { challenge_id: id, active: body.active })
  return { active: body.active }
})
