import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const body = await readBody<{ opt_out: boolean }>(event)

  if (typeof body?.opt_out !== 'boolean') {
    throw createError({ statusCode: 400, message: 'opt_out must be a boolean' })
  }

  const supabase = useSupabaseAdmin()

  const { error } = await supabase
    .from('profiles')
    .update({ leaderboard_opt_out: body.opt_out })
    .eq('id', user.id)

  if (error) throw createError({ statusCode: 500, message: 'Failed to update preference' })

  return { leaderboard_opt_out: body.opt_out }
})
