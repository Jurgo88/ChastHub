import Stripe from 'stripe'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)

  const config = useRuntimeConfig()
  if (!config.stripeSecretKey) {
    throw createError({ statusCode: 503, message: 'Payments are not available yet' })
  }
  const stripe = new Stripe(config.stripeSecretKey)
  const supabase = useSupabaseAdmin()

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_subscription_id, status, current_period_end')
    .eq('user_id', user.id)
    .maybeSingle<{ stripe_subscription_id: string | null; status: string; current_period_end: string | null }>()

  if (!sub?.stripe_subscription_id) {
    throw createError({ statusCode: 404, message: 'No active subscription found' })
  }

  if (sub.status !== 'active') {
    throw createError({ statusCode: 409, message: 'Subscription is not active' })
  }

  // Cancel at period end (user keeps access until then)
  await stripe.subscriptions.update(sub.stripe_subscription_id, {
    cancel_at_period_end: true,
  })

  // TASK-126 — write the flag through immediately rather than waiting for
  // customer.subscription.updated, so the profile reflects the cancellation
  // as soon as the request returns. The webhook writes the same value again.
  const { error: flagError } = await supabase
    .from('subscriptions')
    .update({ cancel_at_period_end: true })
    .eq('user_id', user.id)

  if (flagError) console.error('[subscription/cancel] Failed to persist cancel flag:', flagError)

  return {
    success: true,
    message: 'Subscription will cancel at the end of the current period.',
    current_period_end: sub.current_period_end,
  }
})
