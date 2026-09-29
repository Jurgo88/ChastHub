import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const supabase = useSupabaseAdmin()

  const { data, error } = await supabase
    .from('favorites')
    .select(`
      id,
      created_at,
      profile:profiles!favorited_profile_id(id, display_name, username, avatar_url, role, status)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw createError({ statusCode: 500, message: 'Failed to fetch favorites' })

  const favorites = (data ?? [])
    .filter(f => f.profile && f.profile.status !== 'banned')
    .map((f) => {
      const { status: _status, ...profile } = f.profile!
      return { favorite_id: f.id, created_at: f.created_at, profile }
    })

  return { favorites }
})
