import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { buildSummary, loadLockHistory } from '~/server/utils/loqHistory'

// GET /api/loqs/<id>/summary: numbers for the summary card of a lock.
export default defineEventHandler(async (event) => {
  const { user, isAdmin } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const supabase = useSupabaseAdmin()
  const { loq, events, visitorCount } = await loadLockHistory(supabase, id, user.id, isAdmin)

  // Reactions on the public page; the table may be missing, then it is just 0.
  const { count } = await supabase.from('loq_reactions').select('id', { count: 'exact', head: true }).eq('loq_id', id)
  return { ...buildSummary(loq, events, visitorCount), reactions: count ?? 0 }
})
