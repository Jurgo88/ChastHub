import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock } from './helpers/mockSupabase'

// TASK-181 — "Invite admin" returned 409 for anyone who already had an
// account, because it only ever called inviteUserByEmail. An existing member
// is now promoted in place.

const g = globalThis as Record<string, unknown>
g.defineEventHandler = (fn: unknown) => fn
g.createError = (opts: { statusCode: number, message: string }) => {
  const err = new Error(opts.message) as Error & { statusCode: number }
  err.statusCode = opts.statusCode
  return err
}
let body: unknown
g.readBody = async () => body

let db: ReturnType<typeof createSupabaseMock>
let inviteUserByEmail: ReturnType<typeof vi.fn>

vi.mock('~/server/utils/auth', () => ({
  requireAuth: vi.fn(async () => ({ user: { id: 'super_1' }, adminLevel: 'super_admin' })),
  requireAdminLevel: vi.fn(),
}))
vi.mock('~/server/utils/displayName', () => ({ generateUniqueDisplayName: vi.fn(async () => 'Quiet Otter') }))
vi.mock('~/server/utils/supabaseAdmin', () => ({
  useSupabaseAdmin: () => ({ ...db.client, auth: { admin: { inviteUserByEmail, deleteUser: vi.fn() } } }),
}))

const handler = (await import('~/server/api/admin/admins/index.post')).default as (e: unknown) => Promise<any>

beforeEach(() => {
  body = { email: '  Jana_K@Example.com ', admin_level: 'support' }
  inviteUserByEmail = vi.fn(async () => ({ data: { user: { id: 'new_1' } }, error: null }))
})

describe('POST /api/admin/admins', () => {
  it('promotes an existing active member instead of inviting them', async () => {
    db = createSupabaseMock({ id: 'member_1', status: 'active', is_admin: false, admin_level: null })

    const res = await handler({})

    expect(res).toMatchObject({ success: true, userId: 'member_1', promoted: true })
    expect(inviteUserByEmail).not.toHaveBeenCalled()
    expect(db.callsFor('profiles', 'update')[0].args[0]).toEqual({ is_admin: true, admin_level: 'support' })
    expect(db.callsFor('audit_log', 'insert')[0].args[0]).toMatchObject({
      action: 'admin_invited', target_id: 'member_1', details: { existing_account: true, admin_level: 'support' },
    })
  })

  it('matches the email case-insensitively and treats "_" literally', async () => {
    db = createSupabaseMock(null)
    await handler({})
    expect(db.callsFor('profiles', 'ilike')[0].args).toEqual(['email', 'jana\\_k@example.com'])
  })

  it('says so when they are already an admin, naming the level', async () => {
    db = createSupabaseMock({ id: 'member_1', status: 'active', is_admin: true, admin_level: 'analyst' })
    await expect(handler({})).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('analyst') })
    expect(db.callsFor('profiles', 'update')).toHaveLength(0)
  })

  it('refuses a banned account with a reason', async () => {
    db = createSupabaseMock({ id: 'member_1', status: 'banned', is_admin: false, admin_level: null })
    await expect(handler({})).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('banned') })
    expect(db.callsFor('profiles', 'update')).toHaveLength(0)
  })

  it('still invites an address nobody has used', async () => {
    db = createSupabaseMock(null)

    const res = await handler({})

    expect(res).toMatchObject({ success: true, userId: 'new_1', promoted: false })
    expect(inviteUserByEmail).toHaveBeenCalledWith('jana_k@example.com')
    expect(db.callsFor('profiles', 'upsert')[0].args[0]).toMatchObject({ id: 'new_1', is_admin: true, admin_level: 'support' })
  })

  it('explains a login that never finished signing up', async () => {
    db = createSupabaseMock(null)
    inviteUserByEmail = vi.fn(async () => ({ data: null, error: { message: 'A user with this email address has already been registered' } }))

    await expect(handler({})).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('never finished signing up') })
  })
})
