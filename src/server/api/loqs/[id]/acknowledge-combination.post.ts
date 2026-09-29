import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

// TASK-084 — called once the loqee has seen their revealed combination
// (ended or cancelled loq) so /api/loqs/current stops surfacing it.
export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqee') throw createError({ statusCode: 403, message: 'Only wearers can acknowledge their own combination' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const supabase = useSupabaseAdmin()

  const { data: loq } = await supabase
    .from('loqs')
    .select('id, loqee_id, status')
    .eq('id', id)
    .maybeSingle()

  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  if (loq.loqee_id !== user.id) throw createError({ statusCode: 403, message: 'Not your lock' })
  if (!['ended', 'cancelled'].includes(loq.status)) {
    throw createError({ statusCode: 409, message: 'Lock has no combination to acknowledge' })
  }

  await supabase
    .from('loqs')
    .update({ combination_revealed_at: new Date().toISOString() })
    .eq('id', id)

  return { acknowledged: true }
})
