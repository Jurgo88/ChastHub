import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { buildSummary, loadLockHistory } from '~/server/utils/loqHistory'
import { lockSummarySvg } from '~/server/utils/lockSummaryImage'
import { renderSvgToPng } from '~/server/utils/ogRender'

// GET /api/loqs/<id>/share-image: PNG of the lock's summary, for sharing on X
// and the like. Only the two people on the lock (or an admin) can fetch it.
export default defineEventHandler(async (event) => {
  const { user, isAdmin } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const { loq, events, visitorCount } = await loadLockHistory(useSupabaseAdmin(), id, user.id, isAdmin)
  const png = await renderSvgToPng(lockSummarySvg(buildSummary(loq, events, visitorCount)))

  setResponseHeader(event, 'Content-Type', 'image/png')
  setResponseHeader(event, 'Cache-Control', 'private, max-age=300')
  return png
})
