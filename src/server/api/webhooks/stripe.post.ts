import Stripe from 'stripe'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  if (!config.stripeSecretKey) {
    throw createError({ statusCode: 503, message: 'Payments are not available yet' })
  }
  const stripe = new Stripe(config.stripeSecretKey)

  const rawBody = await readRawBody(event)
  const sig = getRequestHeader(event, 'stripe-signature')

  if (!rawBody || !sig) {
    throw createError({ statusCode: 400, message: 'Missing body or signature' })
  }

  let stripeEvent: Stripe.Event
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, config.stripeWebhookSecret)
  }
  catch {
    throw createError({ statusCode: 400, message: 'Invalid webhook signature' })
  }

  const supabase = useSupabaseAdmin()

  function assertOk(error: { message: string } | null, context: string) {
    if (error) {
      console.error(`[stripe webhook] ${stripeEvent.type} — ${context} failed:`, error.message)
      throw createError({ statusCode: 500, message: `${context} failed: ${error.message}` })
    }
  }

  // TASK-136 — a charge does not carry Stripe's cut; that lives on its
  // balance transaction, which webhook payloads never expand. One retrieve
  // per paid invoice is the price of knowing the fee.
  async function recordCharge(chargeId: string, userId: string | null) {
    const charge = await stripe.charges.retrieve(chargeId, { expand: ['balance_transaction'] })
    const balanceTx = charge.balance_transaction as Stripe.BalanceTransaction | null

    const { error } = await supabase.from('payments').upsert({
      stripe_charge_id: charge.id,
      stripe_invoice_id: typeof charge.invoice === 'string' ? charge.invoice : charge.invoice?.id ?? null,
      stripe_customer_id: typeof charge.customer === 'string' ? charge.customer : charge.customer?.id ?? null,
      user_id: userId,
      amount: charge.amount,
      amount_refunded: charge.amount_refunded,
      fee: balanceTx?.fee ?? 0,
      currency: charge.currency,
      paid_at: new Date(charge.created * 1000).toISOString(),
    }, { onConflict: 'stripe_charge_id' })

    assertOk(error, 'payments upsert')
  }

  // The plan's price, so MRR is a query rather than another Stripe round trip.
  // TASK-187 — Stripe's own "when" for a cancellation and an end, copied
  // rather than stamped with now(): right on retries, and Stripe clears
  // canceled_at again when a customer un-cancels.
  function lifecycleFields(sub: Stripe.Subscription) {
    const iso = (t: number | null | undefined) => (t ? new Date(t * 1000).toISOString() : null)
    return { canceled_at: iso(sub.canceled_at), ended_at: iso(sub.ended_at) }
  }

  function planFields(sub: Stripe.Subscription) {
    const price = sub.items?.data?.[0]?.price
    return {
      plan_amount: price?.unit_amount ?? null,
      plan_interval: price?.recurring?.interval ?? null,
      plan_currency: price?.currency ?? null,
    }
  }

  switch (stripeEvent.type) {
    case 'checkout.session.completed': {
      const session = stripeEvent.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId
      if (!userId || session.mode !== 'subscription') {
        console.warn(`[stripe webhook] checkout.session.completed skipped — userId: ${userId}, mode: ${session.mode}`)
        break
      }

      const stripeSubId = session.subscription as string

      // Fetch full subscription details
      const stripeSub = await stripe.subscriptions.retrieve(stripeSubId)

      const { error: subError } = await supabase.from('subscriptions').upsert({
        user_id: userId,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: stripeSubId,
        status: 'active',
        current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
        cancel_at_period_end: stripeSub.cancel_at_period_end, // TASK-126
        ...planFields(stripeSub), // TASK-136
        // TASK-187 — a new subscription replaces this user's row; the old
        // one's cancel/end must not carry over.
        canceled_at: null,
        ended_at: null,
      }, { onConflict: 'user_id' })
      assertOk(subError, 'subscriptions upsert')

      const { error: profileError } = await supabase.from('profiles')
        .update({ subscription_status: 'active' })
        .eq('id', userId)
      assertOk(profileError, 'profiles update')
      break
    }

    case 'customer.subscription.updated': {
      const sub = stripeEvent.data.object as Stripe.Subscription
      const userId = sub.metadata?.userId

      // Look up user from customer ID if metadata missing
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', sub.id)
        .maybeSingle<{ user_id: string }>()

      const resolvedUserId = userId ?? existingSub?.user_id
      if (!resolvedUserId) {
        console.warn(`[stripe webhook] customer.subscription.updated skipped — no user found for subscription ${sub.id}`)
        break
      }

      const status = sub.status === 'active' ? 'active'
        : sub.status === 'past_due' ? 'past_due'
          : 'inactive'

      const { error: subUpdError } = await supabase.from('subscriptions').upsert({
        user_id: resolvedUserId,
        stripe_customer_id: sub.customer as string,
        stripe_subscription_id: sub.id,
        status,
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        cancel_at_period_end: sub.cancel_at_period_end, // TASK-126
        ...planFields(sub), // TASK-136
        ...lifecycleFields(sub), // TASK-187
      }, { onConflict: 'user_id' })
      assertOk(subUpdError, 'subscriptions upsert')

      const { error: profileUpdError } = await supabase.from('profiles')
        .update({ subscription_status: status === 'active' ? 'active' : 'inactive' })
        .eq('id', resolvedUserId)
      assertOk(profileUpdError, 'profiles update')
      break
    }

    // TASK-136 — the money. Nothing recorded an amount before this.
    case 'invoice.payment_succeeded': {
      const invoice = stripeEvent.data.object as Stripe.Invoice

      // TASK-150 — do not trust the shape of this payload. A webhook event is
      // serialised with the API version configured on the Stripe endpoint,
      // which is independent of the version this SDK pins (2025-02-24.acacia).
      // `Invoice.charge` was removed in 2025-03-31.basil in favour of
      // `invoice.payments[]`, so on a newer endpoint this field is simply
      // absent — and the old code read it, found undefined and broke out of
      // the case. Every payment was skipped in silence, which is why MRR rose
      // (it is computed from `subscriptions`) while every revenue figure,
      // which sums `payments`, stayed where it was.
      //
      // Re-reading the invoice through the SDK sidesteps the question: an API
      // *request* is served in the version the SDK pins, so `charge` is there
      // whatever the endpoint is set to.
      let chargeId = typeof invoice.charge === 'string' ? invoice.charge : invoice.charge?.id

      if (!chargeId && invoice.id) {
        const fresh = await stripe.invoices.retrieve(invoice.id)
        chargeId = typeof fresh.charge === 'string' ? fresh.charge : fresh.charge?.id
      }

      // A 100%-discounted or zero-amount invoice genuinely settles without a
      // charge. Anything else reaching this line is a payment we are failing
      // to record, and it must not disappear quietly a second time.
      if (!chargeId) {
        if (invoice.amount_paid > 0) {
          console.error(
            '[stripe webhook] invoice.payment_succeeded with no resolvable charge —',
            `invoice=${invoice.id} amount_paid=${invoice.amount_paid} `
            + `billing_reason=${invoice.billing_reason}. This payment is NOT in the revenue figures.`,
          )
        }
        break
      }

      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', invoice.customer as string)
        .maybeSingle<{ user_id: string }>()

      // Recorded even when the customer cannot be matched to a profile —
      // revenue is revenue, and user_id is nullable for exactly this.
      await recordCharge(chargeId, existingSub?.user_id ?? null)
      break
    }

    case 'charge.refunded': {
      const charge = stripeEvent.data.object as Stripe.Charge

      // Refunds arrive as an update to the charge, so the row may already be
      // there — but a refund on a charge we never saw (one predating this
      // table, before the backfill runs) must not be dropped silently.
      const { data: existing } = await supabase
        .from('payments')
        .select('id')
        .eq('stripe_charge_id', charge.id)
        .maybeSingle<{ id: string }>()

      if (existing) {
        const { error } = await supabase
          .from('payments')
          .update({ amount_refunded: charge.amount_refunded })
          .eq('stripe_charge_id', charge.id)
        assertOk(error, 'payments refund update')
      }
      else {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', charge.customer as string)
          .maybeSingle<{ user_id: string }>()
        await recordCharge(charge.id, sub?.user_id ?? null)
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = stripeEvent.data.object as Stripe.Invoice
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', invoice.customer as string)
        .maybeSingle<{ user_id: string }>()

      if (!existingSub?.user_id) break

      const { error: pastDueError } = await supabase.from('subscriptions')
        .update({ status: 'past_due' })
        .eq('user_id', existingSub.user_id)
      assertOk(pastDueError, 'subscriptions update (past_due)')
      // Keep profiles.subscription_status active for 3-day grace period
      // (subscription.updated will fire with 'past_due' status eventually)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = stripeEvent.data.object as Stripe.Subscription
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', sub.id)
        .maybeSingle<{ user_id: string }>()

      if (!existingSub?.user_id) break

      const { error: cancelSubError } = await supabase.from('subscriptions')
        .update({
          status: 'inactive',
          stripe_subscription_id: null,
          cancel_at_period_end: false,
          // TASK-187 — ended now if Stripe does not say otherwise.
          canceled_at: lifecycleFields(sub).canceled_at,
          ended_at: lifecycleFields(sub).ended_at ?? new Date().toISOString(),
        })
        .eq('user_id', existingSub.user_id)
      assertOk(cancelSubError, 'subscriptions update (canceled)')

      const { error: cancelProfileError } = await supabase.from('profiles')
        .update({ subscription_status: 'inactive' })
        .eq('id', existingSub.user_id)
      assertOk(cancelProfileError, 'profiles update (canceled)')
      break
    }
  }

  return { received: true }
})
