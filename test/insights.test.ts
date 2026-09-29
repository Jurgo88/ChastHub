import { describe, it, expect, vi, beforeEach } from 'vitest'

// TASK-185…189 — the admin Insights endpoints: who may read which section,
// and a clear message when a section's migration is missing.

const g = globalThis as Record<string, unknown>
g.defineEventHandler = (fn: unknown) => fn
g.createError = (opts: { statusCode: number, message: string }) => {
  const err = new Error(opts.message) as Error & { statusCode: number }
  err.statusCode = opts.statusCode
  return err
}

let adminLevel: string | null = 'analyst'
let rpc: ReturnType<typeof vi.fn>

vi.mock('~/server/utils/auth', () => ({
  requireAuth: vi.fn(async () => ({ user: { id: 'me' }, adminLevel })),
  requireAdminLevel: vi.fn((level: string | null, levels: string[]) => {
    if (!level || !levels.includes(level)) {
      const err = new Error('Forbidden') as Error & { statusCode: number }
      err.statusCode = 403
      throw err
    }
  }),
}))
vi.mock('~/server/utils/supabaseAdmin', () => ({ useSupabaseAdmin: () => ({ rpc }) }))

// Static imports: Vite cannot resolve an aliased dynamic import with a variable.
const ENDPOINTS = {
  sources: () => import('~/server/api/admin/insights/sources.get'),
  marketplace: () => import('~/server/api/admin/insights/marketplace.get'),
  subscriptions: () => import('~/server/api/admin/insights/subscriptions.get'),
  cohorts: () => import('~/server/api/admin/insights/cohorts.get'),
  churn: () => import('~/server/api/admin/insights/churn.get'),
}
const load = async (name: keyof typeof ENDPOINTS) =>
  (await ENDPOINTS[name]()).default as (e: unknown) => Promise<unknown>

beforeEach(() => {
  adminLevel = 'analyst'
  rpc = vi.fn(async () => ({ data: { rows: [] }, error: null }))
})

// TASK-189 — churn reasons: codes and counts only, every admin level.
describe('GET /api/admin/insights/churn', () => {
  it('is open to support admins and calls admin_churn_reasons', async () => {
    adminLevel = 'support'
    await (await load('churn'))({})
    expect(rpc).toHaveBeenCalledWith('admin_churn_reasons')
  })
})

// TASK-188 — cohorts: aggregates, every admin level.
describe('GET /api/admin/insights/cohorts', () => {
  it('is open to analysts and calls admin_retention_cohorts', async () => {
    adminLevel = 'analyst'
    await (await load('cohorts'))({})
    expect(rpc).toHaveBeenCalledWith('admin_retention_cohorts')
  })
})

// TASK-187 — money and names: super_admin only.
describe('GET /api/admin/insights/subscriptions', () => {
  it.each(['analyst', 'support'])('refuses %s admins', async (level) => {
    adminLevel = level
    await expect((await load('subscriptions'))({})).rejects.toMatchObject({ statusCode: 403 })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('is open to super admins', async () => {
    adminLevel = 'super_admin'
    await (await load('subscriptions'))({})
    expect(rpc).toHaveBeenCalledWith('admin_subscription_trends')
  })
})

// TASK-186 — the marketplace section: same gate, its own function.
describe('GET /api/admin/insights/marketplace', () => {
  it('is open to every admin level and calls admin_marketplace', async () => {
    adminLevel = 'support'
    await (await load('marketplace'))({})
    expect(rpc).toHaveBeenCalledWith('admin_marketplace')
  })

  it('names migration 075 when the function is missing', async () => {
    rpc = vi.fn(async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect((await load('marketplace'))({})).rejects.toMatchObject({ message: expect.stringContaining('075') })
    spy.mockRestore()
  })
})

describe('GET /api/admin/insights/sources', () => {
  it.each(['analyst', 'support', 'super_admin'])('is open to %s admins', async (level) => {
    adminLevel = level
    await expect((await load('sources'))({})).resolves.toEqual({ rows: [] })
    expect(rpc).toHaveBeenCalledWith('admin_source_quality')
  })

  it('refuses non-admins before querying', async () => {
    adminLevel = null
    await expect((await load('sources'))({})).rejects.toMatchObject({ statusCode: 403 })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('names the migration when the function is missing', async () => {
    rpc = vi.fn(async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect((await load('sources'))({})).rejects.toMatchObject({ statusCode: 500, message: expect.stringContaining('074') })
    spy.mockRestore()
  })
})
