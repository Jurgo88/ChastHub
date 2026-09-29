import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)

  const body = await readBody<{ profile_id: string }>(event)
  const profileId = body?.profile_id

  if (!profileId) throw createError({ statusCode: 400, message: 'profile_id is required' })
  if (profileId === user.id) throw createError({ statusCode: 400, message: "You can't favorite yourself" })

  const supabase = useSupabaseAdmin()

  const { data: target } = await supabase
    .from('profiles')
    .select('id, status')
    .eq('id', profileId)
    .maybeSingle()

  if (!target || target.status === 'banned') {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  const { error } = await supabase
    .from('favorites')
    .upsert({ user_id: user.id, favorited_profile_id: profileId }, { onConflict: 'user_id,favorited_profile_id' })

  if (error) throw createError({ statusCode: 500, message: 'Failed to favorite user' })

  return { favorited: true }
})
