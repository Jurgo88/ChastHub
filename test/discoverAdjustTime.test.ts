import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock } from './helpers/mockSupabase'

// TASK-142 — Discover makes this endpoint reachable by anyone signed in, not
// just by whoever was handed the share link. Two guards carry that change and
// neither is visible in the UI, so they are asserted here:
//
//   * visitor_permission 'none' — listed, findable, clock untouchable. If this
//     regressed, every loq migrated out of the old queue would silently become
//     votable by strangers, which is exactly what the client ruled out.
//   * per-account rate limiting — one vote per IP per hour was proportionate
//     for a link passed between people. A browsable list is not: mobile data
//     hands out a fresh IP on demand.

const g = globalThis as Record<string, unknown>
g.defineEventHandler = (fn: unknown) => fn
g.createError = (opts: { statusCode: number, message: string }) => {
  const err = new Error(opts.message) as Error & { statusCode: number }
  err.statusCode = opts.statusCode
  return err
}
g.getRouterParam = () => 'public_link_abc'

// TASK-144 — on Netlify this returns undefined (unenv's socket polyfill sets
// remoteAddress to ""), which is the whole reason getClientIp exists. The
// tests model that: the address arrives in a header or not at all.
g.getRequestIP = () => undefined

let requestBody: unknown = { direction: 'add' }
let authHeader: string | undefined
let clientIpHeader: string | undefined = '203.0.113.7'
g.readBody = vi.fn(async () => requestBody)
g.getRequestHeader = vi.fn((_e: unknown, name: string) => {
  if (name === 'authorization') return authHeader
  if (name === 'x-nf-client-connection-ip') return clientIpHeader
  return undefined
})

let db: ReturnType<typeof createSupabaseMock>
let authUser: { id: string } | null = null
const rpc = vi.fn(async () => ({ data: new Date(Date.now() + 7_200_000).toISOString(), error: null }))

vi.mock('~/server/utils/supabaseAdmin', () => ({
  useSupabaseAdmin: () => ({
    ...db.client,
    rpc: (...args: unknown[]) => rpc(...args as []),
    auth: { getUser: async () => ({ data: { user: authUser } }) },
  }),
}))
vi.mock('~/server/utils/broadcastLoq', () => ({ broadcastLoqUpdate: vi.fn() }))
vi.mock('~/server/utils/sendPushNotification', () => ({ sendPushNotification: vi.fn() }))
vi.mock('~/server/utils/rateLimit', () => ({ checkRateLimit: vi.fn(async () => false) }))

const handler = (await import('~/server/api/loq/[public_id]/adjust-time.post')).default as
  (event: unknown) => Promise<unknown>

function loq(overrides: Record<string, unknown> = {}) {
  return {
    id: 'loq_1',
    loqed_until: new Date(Date.now() + 3_600_000).toISOString(),
    status: 'active',
    visitor_add_hours: 1,
    visitor_permission: 'both',
    public_link_id: 'public_link_abc',
    loqee_id: 'owner_1',
    loqholder_id: null,
    ...overrides,
  }
}

describe('POST /api/loq/[public_id]/adjust-time', () => {
  beforeEach(() => {
    rpc.mockClear()
    authUser = null
    authHeader = undefined
    clientIpHeader = '203.0.113.7'
    requestBody = { direction: 'add' }
  })

  it("refuses every direction when the owner picked 'none'", async () => {
    for (const direction of ['add', 'remove'] as const) {
      requestBody = { direction }
      // Lookups in order: the loq, then the rate-limit row.
      db = createSupabaseMock([loq({ visitor_permission: 'none' }), null])

      await expect(handler({})).rejects.toThrow(/not accepting time changes/i)
      expect(rpc).not.toHaveBeenCalled()
    }
  })

  it('still enforces add-only and remove-only', async () => {
    requestBody = { direction: 'remove' }
    db = createSupabaseMock([loq({ visitor_permission: 'add' }), null])

    await expect(handler({})).rejects.toThrow(/can only add/i)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('will not let an owner vote on their own loq', async () => {
    authHeader = 'Bearer token'
    authUser = { id: 'owner_1' }
    db = createSupabaseMock([loq(), null])

    await expect(handler({})).rejects.toThrow(/your own lock/i)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('limits a signed-in voter by account, not by IP', async () => {
    authHeader = 'Bearer token'
    authUser = { id: 'voter_2' }
    db = createSupabaseMock([loq(), null])

    await handler({})

    const filters = db.callsFor('loq_visitor_interactions', 'eq').map(c => c.args[0])
    expect(filters).toContain('user_id')
    expect(filters).not.toContain('ip_hash')
  })

  it('falls back to the IP limit for an anonymous visitor', async () => {
    db = createSupabaseMock([loq(), null])

    await handler({})

    const filters = db.callsFor('loq_visitor_interactions', 'eq').map(c => c.args[0])
    expect(filters).toContain('ip_hash')
    expect(filters).not.toContain('user_id')
  })

  // TASK-144 — the bug the client hit: share the link, the recipient presses
  // add, and is told to come back in an hour despite never having voted.
  // Every visitor hashed to 'unknown', so they all shared one bucket and the
  // first vote on a loq shut the rest out for an hour.
  it('limits each visitor by their own address, not a shared bucket', async () => {
    clientIpHeader = '198.51.100.9'
    db = createSupabaseMock([loq(), null])

    await handler({})

    const ipFilter = db.callsFor('loq_visitor_interactions', 'eq')
      .find(c => c.args[0] === 'ip_hash')
    expect(ipFilter).toBeDefined()

    // A different visitor must query a different bucket, or one person's
    // vote locks out everyone else on that loq.
    const firstHash = ipFilter!.args[1]
    clientIpHeader = '203.0.113.200'
    db = createSupabaseMock([loq(), null])

    await handler({})

    const secondHash = db.callsFor('loq_visitor_interactions', 'eq')
      .find(c => c.args[0] === 'ip_hash')!.args[1]
    expect(secondHash).not.toBe(firstHash)
  })

  it('lets the vote through rather than blocking everyone when there is no address', async () => {
    clientIpHeader = undefined
    db = createSupabaseMock([loq(), null])

    await handler({})

    // Nothing to limit on, so no lookup happened — and crucially no shared
    // sentinel was matched against.
    const filters = db.callsFor('loq_visitor_interactions', 'eq').map(c => c.args[0])
    expect(filters).not.toContain('ip_hash')
    expect(rpc).toHaveBeenCalled()
  })

  // TASK-146 — a loq published to find a loqholder sits at 'pending' with
  // its clock already running (TASK-062) and is listed in Discover. The
  // allow-list here predated that and answered "This loq has ended" to every
  // vote, while the card next to the button counted down.
  it('accepts votes on a pending loq, which is listed and running', async () => {
    db = createSupabaseMock([loq({ status: 'pending' }), null])

    await handler({})

    expect(rpc).toHaveBeenCalled()
  })

  it.each(['ended', 'cancelled', 'draft'])('still turns away a %s loq', async (status) => {
    db = createSupabaseMock([loq({ status }), null])

    await expect(handler({})).rejects.toThrow(/has ended/i)
    expect(rpc).not.toHaveBeenCalled()
  })

  // TASK-147 — the Discover feed is keyed by loq id, and the share page only
  // knows the public link id, so the response has to carry it back.
  it('returns the loq id so the realtime feed can address the right card', async () => {
    db = createSupabaseMock([loq(), null])

    const result = await handler({}) as { loq_id: string; new_loqed_until: string }

    expect(result.loq_id).toBe('loq_1')
    expect(result.new_loqed_until).toBeTruthy()
  })

  it('records who voted, so the limit has something to count', async () => {
    authHeader = 'Bearer token'
    authUser = { id: 'voter_2' }
    db = createSupabaseMock([loq(), null])

    await handler({})

    const [insert] = db.callsFor('loq_visitor_interactions', 'insert')
    expect(insert.args[0]).toMatchObject({ loq_id: 'loq_1', user_id: 'voter_2', direction: 'add' })
  })
})
