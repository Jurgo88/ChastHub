import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const supabase = useSupabaseAdmin()

  const { data, error } = await supabase
    .from('loqholder_leaderboard_all')
    .select('id, display_name, avatar_url, controlled_loqs, username, rank')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, message: 'Failed to fetch rank' })

  return data
})
