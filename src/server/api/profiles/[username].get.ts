import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)

  const username = getRouterParam(event, 'username')
  if (!username) throw createError({ statusCode: 400, message: 'username is required' })

  const supabase = useSupabaseAdmin()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url, bio, role, status, last_seen_at, show_online_status, is_admin')
    .eq('username', username.toLowerCase())
    .maybeSingle()

  // TASK-127 — deleted profiles keep their row (other people's loq and
  // chat history points at it) but must not be reachable.
  if (!profile || profile.status !== 'active') {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  const { status: _status, show_online_status, last_seen_at, ...publicProfile } = profile
  const isSelf = profile.id === user.id
  // Never expose last_seen_at when the profile owner opted out — not even
  // a rounded/fuzzed version, just omit it entirely.
  const visibleLastSeenAt = (isSelf || show_online_status) ? last_seen_at : null

  let isFavorited = false
  if (!isSelf) {
    const { data: favorite } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('favorited_profile_id', profile.id)
      .maybeSingle()
    isFavorited = !!favorite
  }

  return {
    ...publicProfile,
    is_self: isSelf,
    is_favorited: isFavorited,
    last_seen_at: visibleLastSeenAt,
    show_online_status: isSelf ? show_online_status : undefined,
  }
})
