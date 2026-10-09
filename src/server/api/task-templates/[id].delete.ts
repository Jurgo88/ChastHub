import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

// DELETE /api/task-templates/<id>: removes a saved task from the caller's library.
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Template ID required' })

  const { data } = await useSupabaseAdmin()
    .from('task_templates').delete().eq('id', id).eq('owner_id', user.id).select('id')
  if (!data?.length) throw createError({ statusCode: 404, message: 'Saved task not found' })
  return { deleted: true }
})
