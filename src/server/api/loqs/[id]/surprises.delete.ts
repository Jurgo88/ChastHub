import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

// DELETE /api/loqs/<id>/surprises: switch surprises off and drop the plan.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const supabase = useSupabaseAdmin()
  const { data: loq } = await supabase.from('loqs').select('id, loqholder_id').eq('id', id).maybeSingle()
  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  if (loq.loqholder_id !== user.id) throw createError({ statusCode: 403, message: 'Not your lock' })

  await supabase.from('loq_surprises').update({ cancelled_at: new Date().toISOString() }).eq('loq_id', id).is('executed_at', null).is('cancelled_at', null)
  await supabase.from('loq_surprise_settings').delete().eq('loq_id', id)
  return { ok: true }
})
