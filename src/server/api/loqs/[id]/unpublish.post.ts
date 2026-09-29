import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqee') throw createError({ statusCode: 403, message: 'Only wearers can unpublish locks' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const supabase = useSupabaseAdmin()

  const { data: loq } = await supabase
    .from('loqs')
    .select('id, loqee_id, status, is_public')
    .eq('id', id)
    .maybeSingle()

  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  if (loq.loqee_id !== user.id) throw createError({ statusCode: 403, message: 'Not your lock' })
  if (!loq.is_public) throw createError({ statusCode: 409, message: 'Lock is not public' })
  if (!['draft', 'pending'].includes(loq.status)) {
    throw createError({ statusCode: 409, message: 'Cannot unpublish a lock in this state' })
  }

  const { data: updated, error } = await supabase
    .from('loqs')
    .update({ is_public: false, listed_in_discover: false })
    .eq('id', id)
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: 'Failed to unpublish lock' })

  return updated
})
