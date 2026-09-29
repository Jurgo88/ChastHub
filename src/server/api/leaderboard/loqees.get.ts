import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 50, 100)

  const supabase = useSupabaseAdmin()

  const { data, error } = await supabase
    .from('loqee_leaderboard')
    .select('id, display_name, avatar_url, longest_loq_hours, username')
    .limit(limit)

  if (error) throw createError({ statusCode: 500, message: 'Failed to fetch leaderboard' })

  return (data ?? []).map((row, i) => ({ rank: i + 1, ...row }))
})
