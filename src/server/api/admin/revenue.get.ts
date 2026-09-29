import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAdminLevel, requireAuth } from '~/server/utils/auth'

// TASK-136 — revenue is super_admin only, so it lives here rather than on
// /api/admin/metrics, which analysts and support staff can read.

interface RevenueRow {
  currency: string
  payments_count: number
  gross: number
  refunded: number
  fees: number
  gross_30d: number
  refunded_30d: number
  fees_30d: number
  gross_month: number
  refunded_month: number
  fees_month: number
}

interface MrrRow {
  currency: string | null
  mrr: number
  subscriptions: number
}

export default defineEventHandler(async (event) => {
  const { adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['super_admin'])

  const supabase = useSupabaseAdmin()

  const [{ data: revenue, error: revenueError }, { data: mrr, error: mrrError }] = await Promise.all([
    supabase.rpc('admin_revenue_summary'),
    supabase.rpc('admin_mrr'),
  ])

  if (revenueError || mrrError) {
    console.error('[admin/revenue]', revenueError?.message ?? mrrError?.message)
    throw createError({ statusCode: 500, message: 'Failed to fetch revenue' })
  }

  const mrrByCurrency = new Map((mrr as MrrRow[] ?? []).map(m => [m.currency, m]))

  // Amounts stay in minor units all the way to the browser — dividing by 100
  // is a formatting decision, and doing it here would invite a float into a
  // number that has to add up.
  const currencies = (revenue as RevenueRow[] ?? []).map((r) => {
    const m = mrrByCurrency.get(r.currency)
    return {
      currency: r.currency,
      payments_count: r.payments_count,
      lifetime: {
        // What customers actually paid us, refunds taken off.
        collected: r.gross - r.refunded,
        // What was left after Stripe's cut.
        net: r.gross - r.refunded - r.fees,
        gross: r.gross,
        refunded: r.refunded,
        fees: r.fees,
      },
      last_30d: {
        collected: r.gross_30d - r.refunded_30d,
        net: r.gross_30d - r.refunded_30d - r.fees_30d,
      },
      this_month: {
        collected: r.gross_month - r.refunded_month,
        net: r.gross_month - r.refunded_month - r.fees_month,
      },
      mrr: m?.mrr ?? 0,
      active_subscriptions: m?.subscriptions ?? 0,
    }
  })

  // A currency can have live subscriptions but no settled payment yet — a
  // first billing period that has not closed. Without this it would be absent
  // from the response and its MRR would silently not exist.
  for (const m of mrrByCurrency.values()) {
    if (!m.currency || currencies.some(c => c.currency === m.currency)) continue
    currencies.push({
      currency: m.currency,
      payments_count: 0,
      lifetime: { collected: 0, net: 0, gross: 0, refunded: 0, fees: 0 },
      last_30d: { collected: 0, net: 0 },
      this_month: { collected: 0, net: 0 },
      mrr: m.mrr,
      active_subscriptions: m.subscriptions,
    })
  }

  return { currencies }
})
