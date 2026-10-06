import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { buildSummary, loadLockHistory } from '~/server/utils/loqHistory'

// GET /api/loqs/<id>/summary: numbers for the summary card of a lock.
export default defineEventHandler(async (event) => {
  const { user, isAdmin } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const { loq, events, visitorCount } = await loadLockHistory(useSupabaseAdmin(), id, user.id, isAdmin)
  return buildSummary(loq, events, visitorCount)
})
