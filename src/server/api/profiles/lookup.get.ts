import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)

  const query = getQuery(event)
  const username = String(query.username ?? '').trim().toLowerCase()
  if (!username) throw createError({ statusCode: 400, message: 'username is required' })

  const supabase = useSupabaseAdmin()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url, status')
    .eq('username', username)
    .maybeSingle()

  if (!profile || profile.status !== 'active') {
    throw createError({ statusCode: 404, message: 'User not found' })
  }
  if (profile.id === user.id) {
    throw createError({ statusCode: 400, message: "That's you" })
  }

  const { status: _status, ...publicProfile } = profile
  return publicProfile
})
