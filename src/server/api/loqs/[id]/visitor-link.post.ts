import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { generateLinkId } from '~/server/utils/generateLinkId'

export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqholder') throw createError({ statusCode: 403, message: 'Only keyholders can generate visitor links' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const supabase = useSupabaseAdmin()

  const { data: loq } = await supabase
    .from('loqs')
    .select('id, loqholder_id, status, public_link_id')
    .eq('id', id)
    .maybeSingle()

  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  if (loq.loqholder_id !== user.id) throw createError({ statusCode: 403, message: 'Not your lock' })
  if (!['active', 'paused'].includes(loq.status)) {
    throw createError({ statusCode: 409, message: 'Can only generate visitor link for an active lock' })
  }

  if (loq.public_link_id) {
    return { public_link_id: loq.public_link_id }
  }

  const publicLinkId = generateLinkId()

  const { error } = await supabase
    .from('loqs')
    .update({ public_link_id: publicLinkId })
    .eq('id', id)

  if (error) throw createError({ statusCode: 500, message: 'Failed to generate visitor link' })

  return { public_link_id: publicLinkId }
})
