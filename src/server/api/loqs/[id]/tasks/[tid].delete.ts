import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { loadVerificationLock } from '~/server/utils/verificationDb'
import { broadcastSignals } from '~/server/utils/broadcastLoq'

// DELETE /api/loqs/<id>/tasks/<tid>: the author withdraws a task nobody has
// submitted yet. It is kept as cancelled, without reward or penalty.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  const tid = getRouterParam(event, 'tid')
  if (!id || !tid) throw createError({ statusCode: 400, message: 'Lock and task ID required' })

  const supabase = useSupabaseAdmin()
  await loadVerificationLock(supabase, id, user.id)

  const { data } = await supabase
    .from('loq_tasks')
    .update({ status: 'cancelled', resolved_at: new Date().toISOString() })
    .eq('id', tid)
    .eq('loq_id', id)
    .eq('created_by', user.id)
    .eq('status', 'open')
    .select('id')
  if (!data?.length) throw createError({ statusCode: 409, message: 'Only an open task you created can be withdrawn' })
  await broadcastSignals(id)
  return { status: 'cancelled' }
})
