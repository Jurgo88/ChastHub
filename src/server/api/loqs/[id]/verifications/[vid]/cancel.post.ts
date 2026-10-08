import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { loadVerificationLock } from '~/server/utils/verificationDb'

// POST /api/loqs/<id>/verifications/<vid>/cancel: the keyholder (or the wearer
// of a self-lock) withdraws a request that is still waiting for a photo.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  const vid = getRouterParam(event, 'vid')
  if (!id || !vid) throw createError({ statusCode: 400, message: 'Lock and verification ID required' })

  const supabase = useSupabaseAdmin()
  const { isKeyholder, isSelfLock, isWearer } = await loadVerificationLock(supabase, id, user.id)
  if (!isKeyholder && !(isSelfLock && isWearer)) throw createError({ statusCode: 403, message: 'Only the keyholder can cancel' })

  const { data } = await supabase
    .from('loq_verifications')
    .update({ status: 'cancelled' })
    .eq('id', vid)
    .eq('loq_id', id)
    .eq('status', 'pending')
    .select('id')
  if (!data?.length) throw createError({ statusCode: 409, message: 'This request is no longer open' })
  return { status: 'cancelled' }
})
