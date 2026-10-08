import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { getPublicLoqActivity } from '~/server/utils/publicLoqActivity'

export default defineEventHandler(async (event) => {
  const publicId = getRouterParam(event, 'public_id')
  if (!publicId) throw createError({ statusCode: 400, message: 'Missing public_id' })

  const supabase = useSupabaseAdmin()

  // TASK-064: `reason` (the loqee's own note) is safe to surface publicly —
  // it's written for this exact audience. The combination is never
  // selected here, deliberately: it must stay secret until the loq ends,
  // reusing it for a public page would defeat the entire point of a loq.
  const { data: loq, error } = await supabase
    .from('loqs')
    .select('id, loqed_until, emotion, reason, visitor_add_hours, visitor_permission, locked, status, paused_at')
    .eq('public_link_id', publicId)
    .single()

  if (error || !loq) {
    throw createError({ statusCode: 404, message: 'Lock not found' })
  }

  if (['ended', 'cancelled'].includes(loq.status)) {
    throw createError({ statusCode: 410, message: 'This lock has ended' })
  }

  // Issue #6: recent moves, totals, Top teasers and reactions. The internal
  // id stays on the server.
  // `locked` is derived from the status: self-locks were created with the
  // column left at its default (false), which made their public page say
  // the lock had ended. A lock still waiting for a keyholder (pending) is
  // locked too: its clock has been running since it was created.
  const { id, ...publicLoq } = loq
  const activity = await getPublicLoqActivity(id)
  return { ...publicLoq, locked: ['pending', 'active', 'paused'].includes(loq.status), ...activity }
})
