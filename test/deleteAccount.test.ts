import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock } from './helpers/mockSupabase'

// TASK-139 — the address and the reason only survive deletion because they are
// written into audit_log; everything else about the account is scrubbed on the
// way past. Nothing downstream would fail if that write quietly stopped
// carrying them (logAudit swallows its own errors by design), so this asserts
// the payload rather than trusting the call site to stay correct.

// h3's helpers are Nuxt auto-imports in the app; the handler is a plain module
// here, so they have to exist as globals before it is imported.
const g = globalThis as Record<string, unknown>
g.defineEventHandler = (fn: unknown) => fn
g.createError = (opts: { statusCode: number, message: string }) => {
  const err = new Error(opts.message) as Error & { statusCode: number }
  err.statusCode = opts.statusCode
  return err
}
let requestBody: unknown = {}
g.readBody = vi.fn(async () => requestBody)
g.useRuntimeConfig = () => ({ stripeSecretKey: 'sk_test' })

const logAudit = vi.fn()
let db: ReturnType<typeof createSupabaseMock>
let storageList: unknown[] = []
const updateUserById = vi.fn(
  async (_id: string, _attrs: Record<string, unknown>) => ({ error: null }),
)

vi.mock('~/server/utils/auth', () => ({
  requireAuth: vi.fn(async () => ({ user: { id: 'user_1' } })),
}))
vi.mock('~/server/utils/auditLog', () => ({
  logAudit: (...args: unknown[]) => logAudit(...args),
}))
vi.mock('~/server/utils/supabaseAdmin', () => ({
  useSupabaseAdmin: () => ({
    ...db.client,
    storage: { from: () => ({
      list: async () => ({ data: storageList }),
      remove: async () => ({ error: null }),
    }) },
    auth: { admin: { updateUserById } },
  }),
}))

const handler = (await import('~/server/api/profile/delete.post')).default as
  (event: unknown) => Promise<unknown>

const PROFILE = {
  id: 'user_1',
  email: 'leaver@example.com',
  username: 'leaver',
  avatar_url: null,
  status: 'active',
  signup_country: 'SK',
  signup_region: 'BL',
  signup_timezone: 'Europe/Bratislava',
  signup_locale: 'sk-SK',
}

describe('POST /api/profile/delete', () => {
  beforeEach(() => {
    logAudit.mockClear()
    storageList = []
    updateUserById.mockClear()
    // Two maybeSingle lookups in order: the profile, then the subscription.
    db = createSupabaseMock([PROFILE, null])
  })

  it('records the real address and the reason on the audit entry', async () => {
    requestBody = { reason: 'too_expensive', note: 'Could not justify it' }

    await handler({})

    expect(logAudit).toHaveBeenCalledTimes(1)
    const [, action, actorId, targetId, details] = logAudit.mock.calls[0]
    expect(action).toBe('account_deleted')
    expect(actorId).toBe('user_1')
    expect(targetId).toBe('user_1')
    expect(details).toMatchObject({
      email: 'leaver@example.com',
      reason: 'too_expensive',
      note: 'Could not justify it',
    })
  })

  it('stores the address from before the scrub, not the tombstone', async () => {
    requestBody = { reason: 'not_using', note: '' }

    await handler({})

    // The profile update writes a deleted+<uuid>@deleted.chasthub.com address;
    // the audit entry must not end up with that one.
    const scrub = db.callsFor('profiles', 'update').at(-1)?.args[0] as { email: string }
    expect(scrub.email).toMatch(/^deleted\+.*@deleted\.chasthub\.com$/)
    expect(logAudit.mock.calls[0][4].email).toBe('leaver@example.com')
  })

  it('leaves the auth user on a tombstone address so the email can sign up again', async () => {
    requestBody = { reason: 'taking_break', note: '' }

    await handler({})

    const [userId, attrs] = updateUserById.mock.calls[0] as [string, { email: string }]
    expect(userId).toBe('user_1')
    expect(attrs.email).toMatch(/^deleted\+.*@deleted\.chasthub\.com$/)
  })

  it('stores an empty note as null rather than an empty string', async () => {
    requestBody = { reason: 'privacy', note: '   ' }

    await handler({})

    expect(logAudit.mock.calls[0][4].note).toBeNull()
  })

  it('keeps where they signed up from on the audit entry', async () => {
    requestBody = { reason: 'not_using', note: '' }

    await handler({})

    // TASK-141 — the profile copy is scrubbed, so this is the only place a
    // deleted account's origin survives.
    expect(logAudit.mock.calls[0][4]).toMatchObject({
      signup_country: 'SK',
      signup_region: 'BL',
      signup_timezone: 'Europe/Bratislava',
      signup_locale: 'sk-SK',
    })
  })

  it('still clears the origin from the profile row itself', async () => {
    requestBody = { reason: 'not_using', note: '' }

    await handler({})

    const scrub = db.callsFor('profiles', 'update').at(-1)?.args[0] as Record<string, unknown>
    expect(scrub.signup_country).toBeNull()
    expect(scrub.signup_region).toBeNull()
    expect(scrub.signup_timezone).toBeNull()
    expect(scrub.signup_locale).toBeNull()
  })

  it('rejects an unknown reason before touching a single row', async () => {
    requestBody = { reason: 'because', note: '' }

    await expect(handler({})).rejects.toThrow(/choose a reason/i)
    expect(db.calls).toHaveLength(0)
    expect(logAudit).not.toHaveBeenCalled()
  })

  it('rejects a request with no reason at all', async () => {
    requestBody = {}

    await expect(handler({})).rejects.toThrow(/choose a reason/i)
    expect(db.calls).toHaveLength(0)
  })

  it('rejects a note longer than the cap', async () => {
    requestBody = { reason: 'other', note: 'x'.repeat(501) }

    await expect(handler({})).rejects.toThrow(/under 500 characters/i)
    expect(db.calls).toHaveLength(0)
  })
})
