import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { MILESTONE_COPY, isMilestoneKey } from '~/server/utils/milestones'

// GET /api/loqs/<id>/milestones: the newest milestone the wearer has not
// dismissed yet (or null), for the card on the dashboard.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const supabase = useSupabaseAdmin()
  const { data: loq } = await supabase.from('loqs').select('id, loqee_id').eq('id', id).maybeSingle()
  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  if (loq.loqee_id !== user.id) throw createError({ statusCode: 403, message: 'Access denied' })

  const { data } = await supabase
    .from('loq_milestones')
    .select('key, reached_at')
    .eq('loq_id', id)
    .is('seen_at', null)
    .order('reached_at', { ascending: false })
    .limit(1)

  const row = data?.[0]
  if (!row || !isMilestoneKey(row.key)) return { milestone: null }
  return { milestone: { key: row.key, reached_at: row.reached_at, ...MILESTONE_COPY[row.key] } }
})
