import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { loadWheelLock } from '~/server/utils/wheelAccess'

// GET /api/loqs/<id>/wheel: the wheel, the last 20 spins and when the next one
// is allowed. Wearer and keyholder of the lock only.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const supabase = useSupabaseAdmin()
  const { loq, role, selfLock } = await loadWheelLock(supabase, id, user.id)

  const [{ data: wheel }, { data: spins }] = await Promise.all([
    supabase.from('loq_wheels').select('enabled, segments, interval_minutes, locked_config, next_spin_at').eq('loq_id', id).maybeSingle(),
    supabase.from('loq_wheel_spins').select('id, segment_index, segment, applied, delta_minutes, created_at').eq('loq_id', id).order('created_at', { ascending: false }).limit(20),
  ])

  return {
    role,
    can_edit: role === 'keyholder' || selfLock,
    wheel: wheel ?? null,
    spins: spins ?? [],
    frozen_until: loq.frozen_until && new Date(loq.frozen_until).getTime() > Date.now() ? loq.frozen_until : null,
  }
})
