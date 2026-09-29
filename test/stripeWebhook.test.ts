import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { createSupabaseMock } from './helpers/mockSupabase'
import type { EventHandler } from 'h3'

// Shared, hoisted state the mocked `stripe` and `supabaseAdmin` modules read
// from, so each test can drive the webhook input without re-mocking.
const state = vi.hoisted(() => ({
  event: null as unknown,
  throwOnConstruct: false,
  retrieve: {
    current_period_end: 1_800_000_000,
    items: { data: [{ price: { unit_amount: 999, currency: 'eur', recurring: { interval: 'month' } } }] },
  } as Record<string, unknown>,
  charge: {
    id: 'ch_1',
    invoice: 'in_1',
    customer: 'cus_1',
    amount: 999,
    amount_refunded: 0,
    currency: 'eur',
    created: 1_800_000_000,
    balance_transaction: { fee: 59 },
  } as Record<string, unknown>,
  // TASK-150 — what a re-read of the invoice returns, in the API version
  // this SDK pins (where `charge` still exists).
  invoice: { id: 'in_1', charge: 'ch_1' } as Record<string, unknown>,
  rawBody: 'raw-body' as string | undefined,
  sig: 'sig' as string | undefined,
  supabase: null as ReturnType<typeof import('./helpers/mockSupabase').createSupabaseMock> | null,
}))

vi.mock('stripe', () => ({
  default: class {
    webhooks = {
      constructEvent: (..._args: unknown[]) => {
        if (state.throwOnConstruct) throw new Error('Invalid signature')
        return state.event
      },
    }

    subscriptions = {
      retrieve: async () => state.retrieve,
    }

    charges = {
      retrieve: async () => state.charge,
    }

    invoices = {
      retrieve: async () => state.invoice,
    }
  },
}))

vi.mock('~/server/utils/supabaseAdmin', () => ({
  useSupabaseAdmin: () => state.supabase?.client,
}))

let handler: EventHandler

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (fn: EventHandler) => fn)
  vi.stubGlobal('useRuntimeConfig', () => ({ stripeSecretKey: 'sk_test', stripeWebhookSecret: 'whsec_test' }))
  vi.stubGlobal('readRawBody', async () => state.rawBody)
  vi.stubGlobal('getRequestHeader', () => state.sig)
  vi.stubGlobal('createError', (opts: { statusCode: number, message: string }) => Object.assign(new Error(opts.message), opts))

  handler = (await import('~/server/api/webhooks/stripe.post')).default as EventHandler
})

// The handler only reads body/header/config through the stubbed globals.
const call = () => handler({} as never)

beforeEach(() => {
  state.throwOnConstruct = false
  state.rawBody = 'raw-body'
  state.sig = 'sig'
  // Tests that exercise a missing charge mutate this; reset it so order
  // cannot decide whether they pass.
  state.invoice = { id: 'in_1', charge: 'ch_1' }
  state.supabase = createSupabaseMock({ user_id: 'user_1' })
})

describe('stripe webhook', () => {
  it('rejects a request with no body or signature', async () => {
    state.rawBody = undefined
    await expect(call()).rejects.toThrow(/Missing body or signature/)
  })

  it('rejects an invalid signature', async () => {
    state.throwOnConstruct = true
    await expect(call()).rejects.toThrow(/Invalid webhook signature/)
  })

  it('activates a subscription on checkout.session.completed', async () => {
    state.event = {
      type: 'checkout.session.completed',
      data: { object: { mode: 'subscription', metadata: { userId: 'user_1' }, subscription: 'sub_1', customer: 'cus_1' } },
    }

    const res = await call()
    expect(res).toEqual({ received: true })

    const upserts = state.supabase!.callsFor('subscriptions', 'upsert')
    expect(upserts).toHaveLength(1)
    expect(upserts[0].args[0]).toMatchObject({
      user_id: 'user_1',
      status: 'active',
      // TASK-136 — MRR cannot be computed without these.
      plan_amount: 999,
      plan_interval: 'month',
      plan_currency: 'eur',
      // TASK-187 — a new subscription does not inherit the old one's cancel/end.
      canceled_at: null,
      ended_at: null,
    })
    // Idempotency is enforced by upserting on the user_id conflict target.
    expect(upserts[0].args[1]).toEqual({ onConflict: 'user_id' })

    const profileUpdates = state.supabase!.callsFor('profiles', 'update')
    expect(profileUpdates[0].args[0]).toMatchObject({ subscription_status: 'active' })
  })

  it('is idempotent — replaying the same checkout event upserts again on the same conflict target', async () => {
    state.event = {
      type: 'checkout.session.completed',
      data: { object: { mode: 'subscription', metadata: { userId: 'user_1' }, subscription: 'sub_1', customer: 'cus_1' } },
    }

    await call()
    await call()

    const upserts = state.supabase!.callsFor('subscriptions', 'upsert')
    expect(upserts).toHaveLength(2)
    for (const u of upserts) {
      expect(u.args[1]).toEqual({ onConflict: 'user_id' })
    }
  })

  it('ignores a checkout session that is not a subscription', async () => {
    state.event = {
      type: 'checkout.session.completed',
      data: { object: { mode: 'payment', metadata: { userId: 'user_1' } } },
    }

    await call()
    expect(state.supabase!.callsFor('subscriptions', 'upsert')).toHaveLength(0)
  })

  it('marks the subscription past_due on invoice.payment_failed without downgrading the profile', async () => {
    state.event = { type: 'invoice.payment_failed', data: { object: { customer: 'cus_1' } } }

    await call()

    const subUpdates = state.supabase!.callsFor('subscriptions', 'update')
    expect(subUpdates).toHaveLength(1)
    expect(subUpdates[0].args[0]).toEqual({ status: 'past_due' })
    // Profile stays active during the grace period.
    expect(state.supabase!.callsFor('profiles', 'update')).toHaveLength(0)
  })

  it('deactivates on customer.subscription.deleted', async () => {
    state.event = { type: 'customer.subscription.deleted', data: { object: { id: 'sub_1' } } }

    await call()

    const subUpdates = state.supabase!.callsFor('subscriptions', 'update')
    expect(subUpdates[0].args[0]).toMatchObject({ status: 'inactive', stripe_subscription_id: null })

    const profileUpdates = state.supabase!.callsFor('profiles', 'update')
    expect(profileUpdates[0].args[0]).toMatchObject({ subscription_status: 'inactive' })
  })

  it('maps an active customer.subscription.updated to active status', async () => {
    state.event = {
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_1',
          status: 'active',
          customer: 'cus_1',
          current_period_end: 1_800_000_000,
          metadata: {},
          items: { data: [{ price: { unit_amount: 1999, currency: 'eur', recurring: { interval: 'year' } } }] },
        },
      },
    }

    await call()

    const upserts = state.supabase!.callsFor('subscriptions', 'upsert')
    expect(upserts[0].args[0]).toMatchObject({ status: 'active', plan_amount: 1999, plan_interval: 'year' })
    expect(state.supabase!.callsFor('profiles', 'update')[0].args[0]).toMatchObject({ subscription_status: 'active' })
  })

  // ── TASK-187 — when a subscription was cancelled / ended ──────────────────

  it('copies Stripe\'s canceled_at on customer.subscription.updated, and clears it on un-cancel', async () => {
    const base = { id: 'sub_1', status: 'active', customer: 'cus_1', current_period_end: 1_800_000_000, metadata: {}, items: { data: [] } }
    state.event = { type: 'customer.subscription.updated', data: { object: { ...base, cancel_at_period_end: true, canceled_at: 1_790_000_000 } } }
    await call()
    expect(state.supabase!.callsFor('subscriptions', 'upsert')[0].args[0])
      .toMatchObject({ canceled_at: new Date(1_790_000_000 * 1000).toISOString(), ended_at: null })

    state.event = { type: 'customer.subscription.updated', data: { object: { ...base, cancel_at_period_end: false, canceled_at: null } } }
    await call()
    expect(state.supabase!.callsFor('subscriptions', 'upsert').at(-1)!.args[0]).toMatchObject({ canceled_at: null })
  })

  it('records when a subscription ended on customer.subscription.deleted', async () => {
    state.event = { type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', canceled_at: 1_790_000_000, ended_at: 1_795_000_000 } } }
    await call()
    expect(state.supabase!.callsFor('subscriptions', 'update')[0].args[0]).toMatchObject({
      canceled_at: new Date(1_790_000_000 * 1000).toISOString(),
      ended_at: new Date(1_795_000_000 * 1000).toISOString(),
    })
  })

  it('falls back to now for the end when Stripe sends none', async () => {
    state.event = { type: 'customer.subscription.deleted', data: { object: { id: 'sub_1' } } }
    await call()
    const update = state.supabase!.callsFor('subscriptions', 'update')[0].args[0] as Record<string, unknown>
    expect(typeof update.ended_at).toBe('string')
  })

  // ── TASK-136 — payments ───────────────────────────────────────────────────

  it('records a payment on invoice.payment_succeeded, with the Stripe fee', async () => {
    state.event = { type: 'invoice.payment_succeeded', data: { object: { charge: 'ch_1', customer: 'cus_1' } } }

    await call()

    const upserts = state.supabase!.callsFor('payments', 'upsert')
    expect(upserts).toHaveLength(1)
    expect(upserts[0].args[0]).toMatchObject({
      stripe_charge_id: 'ch_1',
      user_id: 'user_1',
      amount: 999,
      amount_refunded: 0,
      // The fee lives on the balance transaction, not the charge.
      fee: 59,
      currency: 'eur',
    })
    // Stripe retries deliveries; the charge id is what makes a replay a no-op.
    expect(upserts[0].args[1]).toEqual({ onConflict: 'stripe_charge_id' })
  })

  // TASK-150 — the bug behind "MRR moves but revenue does not". A webhook
  // payload is serialised in the API version set on the Stripe endpoint, not
  // the one this SDK pins: `Invoice.charge` was removed in 2025-03-31.basil,
  // so on a newer endpoint the field is simply absent and the old code broke
  // out of the case, skipping the payment without a word.
  it('records the payment when the payload has no charge field at all', async () => {
    state.event = {
      type: 'invoice.payment_succeeded',
      data: { object: { id: 'in_1', customer: 'cus_1', amount_paid: 999 } },
    }

    await call()

    const upserts = state.supabase!.callsFor('payments', 'upsert')
    expect(upserts).toHaveLength(1)
    expect(upserts[0].args[0]).toMatchObject({ stripe_charge_id: 'ch_1', amount: 999 })
  })

  it('ignores a zero-amount invoice that settled without a charge', async () => {
    state.invoice = { id: 'in_1', charge: null }
    state.event = {
      type: 'invoice.payment_succeeded',
      data: { object: { id: 'in_1', charge: null, customer: 'cus_1', amount_paid: 0 } },
    }

    await call()
    expect(state.supabase!.callsFor('payments', 'upsert')).toHaveLength(0)
  })

  it('shouts when a paid invoice has no charge to be found, rather than dropping it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    state.invoice = { id: 'in_1', charge: null }
    state.event = {
      type: 'invoice.payment_succeeded',
      data: { object: { id: 'in_1', charge: null, customer: 'cus_1', amount_paid: 999 } },
    }

    await call()

    expect(state.supabase!.callsFor('payments', 'upsert')).toHaveLength(0)
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('no resolvable charge'),
      expect.stringContaining('in_1'),
    )
    error.mockRestore()
  })

  it('updates the refunded amount on charge.refunded', async () => {
    state.event = {
      type: 'charge.refunded',
      data: { object: { id: 'ch_1', customer: 'cus_1', amount_refunded: 500 } },
    }

    await call()

    const updates = state.supabase!.callsFor('payments', 'update')
    expect(updates).toHaveLength(1)
    expect(updates[0].args[0]).toEqual({ amount_refunded: 500 })
  })

  it('does no writes for an unhandled event type', async () => {
    state.event = { type: 'customer.created', data: { object: {} } }

    const res = await call()
    expect(res).toEqual({ received: true })
    expect(state.supabase!.from).not.toHaveBeenCalled()
  })
})
