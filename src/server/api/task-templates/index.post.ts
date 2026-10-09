import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { MAX_TEMPLATES, parseTaskInput } from '~/server/utils/tasks'

// POST /api/task-templates { text, proof, reward_minutes, penalty_minutes }:
// saves a task to the caller's library.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const input = parseTaskInput(await readBody<Record<string, unknown>>(event))
  if (typeof input === 'string') throw createError({ statusCode: 400, message: input })

  const supabase = useSupabaseAdmin()
  const { count } = await supabase.from('task_templates').select('id', { count: 'exact', head: true }).eq('owner_id', user.id)
  if ((count ?? 0) >= MAX_TEMPLATES) throw createError({ statusCode: 409, message: `At most ${MAX_TEMPLATES} saved tasks` })

  const { data, error } = await supabase
    .from('task_templates')
    .insert({ owner_id: user.id, ...input })
    .select('id, text, proof, reward_minutes, penalty_minutes, created_at')
    .single()
  if (error || !data) throw createError({ statusCode: 500, message: 'Failed to save the task' })
  return data
})
