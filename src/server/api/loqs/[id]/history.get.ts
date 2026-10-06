import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { filterHistory, HISTORY_FILTERS, loadLockHistory, type HistoryFilter } from '~/server/utils/loqHistory'

// GET /api/loqs/<id>/history?filter=all|time|pauses|visitors: the lock's
// timeline, newest first. Only the wearer, the keyholder and admins.
export default defineEventHandler(async (event) => {
  const { user, isAdmin } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const raw = String(getQuery(event).filter ?? 'all')
  if (!(HISTORY_FILTERS as readonly string[]).includes(raw)) {
    throw createError({ statusCode: 400, message: 'Unknown filter' })
  }

  const { events } = await loadLockHistory(useSupabaseAdmin(), id, user.id, isAdmin)
  return { events: filterHistory(events, raw as HistoryFilter).reverse() }
})
