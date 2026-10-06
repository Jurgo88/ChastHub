import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

// GET /api/loqs/<id>/surprises: the keyholder's settings and the plan. The
// wearer gets nothing here on purpose: the planned moments are the surprise.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const supabase = useSupabaseAdmin()
  const { data: loq } = await supabase.from('loqs').select('id, loqholder_id').eq('id', id).maybeSingle()
  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  if (loq.loqholder_id !== user.id) throw createError({ statusCode: 403, message: 'Only the keyholder can see this' })

  const [{ data: settings }, { data: upcoming }, { data: done }] = await Promise.all([
    supabase.from('loq_surprise_settings').select('per_week, min_minutes, max_minutes, allow_remove, window_start, window_end, tz, message').eq('loq_id', id).maybeSingle(),
    supabase.from('loq_surprises').select('id, due_at, delta_minutes').eq('loq_id', id).is('executed_at', null).is('cancelled_at', null).order('due_at', { ascending: true }).limit(30),
    supabase.from('loq_surprises').select('id, due_at, delta_minutes, executed_at').eq('loq_id', id).not('executed_at', 'is', null).order('executed_at', { ascending: false }).limit(10),
  ])

  return { settings: settings ?? null, upcoming: upcoming ?? [], executed: done ?? [] }
})
