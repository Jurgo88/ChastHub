import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { isValidEmotion } from '~/server/utils/loqValidation'

export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqee') throw createError({ statusCode: 403, message: 'Only wearers can update emotion' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const body = await readBody<{ emotion: string }>(event)
  const { emotion } = body ?? {}

  if (!emotion || !isValidEmotion(emotion)) {
    throw createError({ statusCode: 400, message: 'Invalid emotion' })
  }

  const supabase = useSupabaseAdmin()

  const { data: loq } = await supabase
    .from('loqs')
    .select('id, loqee_id, status')
    .eq('id', id)
    .maybeSingle()

  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  if (loq.loqee_id !== user.id) throw createError({ statusCode: 403, message: 'Not your lock' })
  if (!['active', 'paused'].includes(loq.status)) {
    throw createError({ statusCode: 409, message: 'Can only change emotion on an active lock' })
  }

  const { data: updated, error } = await supabase
    .from('loqs')
    .update({ emotion })
    .eq('id', id)
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: 'Failed to update emotion' })

  return updated
})
