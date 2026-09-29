import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { getProfileStats } from '~/server/utils/profileStats'

// The caller's own numbers for the header on /profile.
export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  const supabase = useSupabaseAdmin()
  const { data } = await supabase.from('profiles').select('leaderboard_opt_out').eq('id', user.id).single()
  return getProfileStats(supabase, user.id, role, { leaderboardOptOut: data?.leaderboard_opt_out ?? false })
})
