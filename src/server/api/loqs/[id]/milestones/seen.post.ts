import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

// POST /api/loqs/<id>/milestones/seen: the wearer closed the milestone card.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const supabase = useSupabaseAdmin()
  const { data: loq } = await supabase.from('loqs').select('id, loqee_id').eq('id', id).maybeSingle()
  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  if (loq.loqee_id !== user.id) throw createError({ statusCode: 403, message: 'Access denied' })

  await supabase.from('loq_milestones').update({ seen_at: new Date().toISOString() }).eq('loq_id', id).is('seen_at', null)
  return { ok: true }
})
