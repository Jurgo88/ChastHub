import Stripe from 'stripe'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)

  if (role !== 'loqee') {
    throw createError({ statusCode: 403, message: 'Keyholders use the platform for free' })
  }

  const body = await readBody<{ plan: 'monthly' | 'yearly'; returnUrl: string }>(event)
  const { plan, returnUrl } = body ?? {}

  if (!plan || !returnUrl) {
    throw createError({ statusCode: 400, message: 'plan and returnUrl are required' })
  }

  const config = useRuntimeConfig()

  if (!config.stripeSecretKey) {
    throw createError({ statusCode: 503, message: 'Payments are not available yet' })
  }

  // Price IDs stay server-side — client only sends the plan name
  const priceId = plan === 'monthly' ? config.stripeMonthlyPriceId : config.stripeYearlyPriceId
  if (!priceId) {
    throw createError({ statusCode: 500, message: `Price ID not configured for plan: ${plan}` })
  }

  const stripe = new Stripe(config.stripeSecretKey)
  const supabase = useSupabaseAdmin()

  // Get or create Stripe customer
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle<{ stripe_customer_id: string }>()

  let customerId = existingSub?.stripe_customer_id

  if (!customerId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single<{ email: string }>()

    const customer = await stripe.customers.create({
      email: profile?.email,
      metadata: { userId: user.id },
    })

    customerId = customer.id

    // Upsert subscription row with customer ID
    await supabase.from('subscriptions').upsert({
      user_id: user.id,
      stripe_customer_id: customerId,
      status: 'inactive',
    }, { onConflict: 'user_id' })
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${returnUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnUrl}/subscription/upgrade`,
    metadata: { userId: user.id },
  })

  if (!session.url) {
    throw createError({ statusCode: 500, message: 'Failed to create checkout session' })
  }

  return { url: session.url }
})
