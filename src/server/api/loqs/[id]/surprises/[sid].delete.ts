import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

// DELETE /api/loqs/<id>/surprises/<sid>: cancel one planned surprise.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  const sid = getRouterParam(event, 'sid')
  if (!id || !sid) throw createError({ statusCode: 400, message: 'Lock and surprise ID required' })

  const supabase = useSupabaseAdmin()
  const { data: loq } = await supabase.from('loqs').select('id, loqholder_id').eq('id', id).maybeSingle()
  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  if (loq.loqholder_id !== user.id) throw createError({ statusCode: 403, message: 'Not your lock' })

  const { data } = await supabase
    .from('loq_surprises')
    .update({ cancelled_at: new Date().toISOString() })
    .eq('id', sid)
    .eq('loq_id', id)
    .is('executed_at', null)
    .is('cancelled_at', null)
    .select('id')
  if (!data?.length) throw createError({ statusCode: 404, message: 'Surprise not found' })
  return { ok: true }
})
