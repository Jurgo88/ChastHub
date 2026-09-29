import { requireAuth } from '~/server/utils/auth'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { isLoungeModerator, pingLounge } from '~/server/utils/lounge'
import { logAudit } from '~/server/utils/auditLog'

// Moderators: stop someone writing in the Lounge for a while. Reading stays open.
export default defineEventHandler(async (event) => {
  const { user, adminLevel } = await requireAuth(event)
  if (!isLoungeModerator(adminLevel)) throw createError({ statusCode: 403, message: 'Not allowed' })

  const body = await readBody<{ user_id?: string; hours?: number; reason?: string; delete_messages?: boolean }>(event)
  const target = body?.user_id
  const hours = Number(body?.hours)
  if (!target || typeof target !== 'string') throw createError({ statusCode: 400, message: 'user_id is required' })
  if (target === user.id) throw createError({ statusCode: 400, message: 'You can not mute yourself' })
  if (!Number.isFinite(hours) || hours < 1 || hours > 24 * 45) throw createError({ statusCode: 400, message: 'hours must be between 1 and 1080' })

  const supabase = useSupabaseAdmin()
  const until = new Date(Date.now() + hours * 3_600_000).toISOString()
  const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 200) : null

  const { error } = await supabase
    .from('lounge_mutes')
    .upsert({ user_id: target, muted_until: until, muted_by: user.id, reason, created_at: new Date().toISOString() })
  if (error) throw createError({ statusCode: 500, message: 'Could not mute' })

  // Optionally clear what they wrote in the last hour.
  if (body?.delete_messages) {
    await supabase
      .from('lounge_messages')
      .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
      .eq('user_id', target)
      .is('deleted_at', null)
      .gte('created_at', new Date(Date.now() - 3_600_000).toISOString())
    await pingLounge({ reload: true })
  }

  await logAudit(supabase, 'lounge_mute', user.id, target, { hours, reason, until })
  return { muted_until: until }
})
