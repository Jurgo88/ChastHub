import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { cachePublicStats } from '~/server/utils/statsBoards'

// Community totals for the top of /stats. Counts only, no names.
export default defineEventHandler(async (event) => {
  const { data, error } = await useSupabaseAdmin().rpc('stats_pulse')
  if (error) {
    console.error('[stats/pulse]', error.message)
    throw createError({ statusCode: 500, message: 'Could not load the numbers' })
  }
  cachePublicStats(event)
  return data
})
