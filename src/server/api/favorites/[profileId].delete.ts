import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)

  const profileId = getRouterParam(event, 'profileId')
  if (!profileId) throw createError({ statusCode: 400, message: 'profileId is required' })

  const supabase = useSupabaseAdmin()

  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', user.id)
    .eq('favorited_profile_id', profileId)

  if (error) throw createError({ statusCode: 500, message: 'Failed to unfavorite user' })

  return { favorited: false }
})
