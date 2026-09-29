import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock } from './helpers/mockSupabase'

// TASK-171 — the admin user page's API returns the last 30 days of activity,
// and a failure there never takes the rest of the page down.

const g = globalThis as Record<string, unknown>
g.defineEventHandler = (fn: unknown) => fn
g.createError = (opts: { statusCode: number, message: string }) => {
  const err = new Error(opts.message) as Error & { statusCode: number }
  err.statusCode = opts.statusCode
  return err
}
const ID = '11111111-1111-1111-1111-111111111111'
g.getRouterParam = () => ID

let db: ReturnType<typeof createSupabaseMock>

vi.mock('~/server/utils/auth', () => ({
  requireAuth: vi.fn(async () => ({ user: { id: 'admin_1' }, adminLevel: 'support' })),
  requireAdminLevel: vi.fn(),
}))
vi.mock('~/server/utils/supabaseAdmin', () => ({ useSupabaseAdmin: () => db.client }))

const handler = (await import('~/server/api/admin/users/[id]/index.get')).default as (e: unknown) => Promise<any>

// maybeSingle() lookups in call order: listing, profile, last ban, tracking start.
const listing = { id: ID, email: 'u@x', status: 'active', is_admin: false }
const profile = { bio: null, admin_level: null }

beforeEach(() => {
  db = createSupabaseMock([listing, profile, null, { day: '2026-09-26' }], [{ day: '2026-09-26', sessions: 3, heartbeats: 40 }])
})

describe('GET /api/admin/users/[id] — activity', () => {
  it('returns the last 30 days of activity and when tracking began', async () => {
    const res = await handler({})

    expect(res.activity_30d).toEqual([{ day: '2026-09-26', sessions: 3, heartbeats: 40 }])
    expect(res.activity_tracking_since).toBe('2026-09-26')
    const gte = db.callsFor('user_activity_days', 'gte')[0].args
    expect(gte[0]).toBe('day')
    expect(gte[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('still returns the user when the activity query fails', async () => {
    const client = db.client as { from: (t: string) => any }
    const realFrom = client.from
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    client.from = (table: string) => {
      const b = realFrom(table)
      if (table !== 'user_activity_days') return b
      // A failing list query: order() is the last call in the chain.
      return { ...b, select: () => ({ eq: () => ({ gte: () => ({ order: async () => ({ data: null, error: { message: 'relation does not exist' } }) }) }), order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }
    }

    const res = await handler({})

    expect(res.id).toBe(ID)
    expect(res.activity_30d).toBeNull()
    spy.mockRestore()
  })
})
