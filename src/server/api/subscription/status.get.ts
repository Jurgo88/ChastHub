import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import type { Subscription } from '~/types'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const supabase = useSupabaseAdmin()

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle<Subscription>()

  return { subscription: subscription ?? null }
})
