import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

// GET /api/task-templates: the caller's own task library, newest first.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const { data } = await useSupabaseAdmin()
    .from('task_templates')
    .select('id, text, proof, reward_minutes, penalty_minutes, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)
  return { templates: data ?? [] }
})
