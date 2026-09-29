import { requireAuth } from '~/server/utils/auth'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { isLoungeModerator, pingLounge } from '~/server/utils/lounge'
import { logAudit } from '~/server/utils/auditLog'

// Authors can take back their own message, moderators any message.
export default defineEventHandler(async (event) => {
  const { user, adminLevel } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Message id required' })

  const supabase = useSupabaseAdmin()
  const { data: msg } = await supabase.from('lounge_messages').select('id, user_id, content').eq('id', id).is('deleted_at', null).maybeSingle()
  if (!msg) throw createError({ statusCode: 404, message: 'Message not found' })

  const moderator = isLoungeModerator(adminLevel)
  if (msg.user_id !== user.id && !moderator) throw createError({ statusCode: 403, message: 'Not allowed' })

  const { error } = await supabase
    .from('lounge_messages')
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq('id', id)
  if (error) throw createError({ statusCode: 500, message: 'Could not delete' })

  if (moderator && msg.user_id && msg.user_id !== user.id) {
    await logAudit(supabase, 'lounge_message_deleted', user.id, msg.user_id, { message_id: id, content: msg.content })
  }
  await pingLounge({ deleted: id })
  return { ok: true }
})
