import { requireAuth } from '~/server/utils/auth'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)

  const body = await readBody<{ endpoint: string }>(event)

  if (!body?.endpoint) {
    throw createError({ statusCode: 400, message: 'Endpoint required' })
  }

  const supabase = useSupabaseAdmin()

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', body.endpoint)

  return { ok: true }
})
