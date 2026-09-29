import { requireAuth } from '~/server/utils/auth'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { getLoungeStatus } from '~/server/utils/lounge'

// "Remind me": one push when the next session opens. { on: false } cancels.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const body = await readBody<{ on?: boolean }>(event)
  const status = await getLoungeStatus()
  if (!status.enabled || !status.next) throw createError({ statusCode: 409, message: 'There is no upcoming session.' })

  const supabase = useSupabaseAdmin()
  if (body?.on === false) {
    await supabase.from('lounge_reminders').delete().eq('user_id', user.id).eq('session_start', status.next.start)
    return { reminder_for: null }
  }

  const { error } = await supabase
    .from('lounge_reminders')
    .upsert({ user_id: user.id, session_start: status.next.start }, { onConflict: 'user_id,session_start' })
  if (error) throw createError({ statusCode: 500, message: 'Could not save the reminder' })
  return { reminder_for: status.next.start }
})
