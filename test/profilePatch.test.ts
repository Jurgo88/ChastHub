import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock } from './helpers/mockSupabase'

// TASK-161 — PATCH /api/profile carries the "Show me in search" switch;
// TASK-162 — and returns the full row the client stores.

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

vi.mock('~/server/utils/auth', () => ({
  requireAuth: vi.fn(async () => ({ user: { id: 'me' } })),
}))
vi.mock('~/server/utils/supabaseAdmin', () => ({
  useSupabaseAdmin: () => db.client,
}))

const handler = (await import('~/server/api/profile/index.patch')).default as (e: unknown) => Promise<unknown>

describe('PATCH /api/profile — hide_from_search', () => {
  beforeEach(() => { db = createSupabaseMock({ id: 'me', hide_from_search: true }) })

  it('saves the switch and returns it', async () => {
    body = { hide_from_search: true }

    const res = await handler({}) as Record<string, unknown>

    expect(db.callsFor('profiles', 'update')[0].args[0]).toEqual({ hide_from_search: true })
    expect(res.hide_from_search).toBe(true)
  })

  // TASK-162 — the client replaces its profile with this response, so it has
  // to be the whole row. A narrowed list dropped is_admin and admin_level.
  it('returns the whole row, so the session keeps admin rights', async () => {
    db = createSupabaseMock({ id: 'me', is_admin: true, admin_level: 'super_admin', hide_from_search: false })
    body = { hide_from_search: false }

    const res = await handler({}) as Record<string, unknown>

    expect(db.callsFor('profiles', 'select')[0].args[0]).toBe('*')
    expect(db.callsFor('profiles', 'eq')[0].args).toEqual(['id', 'me'])
    expect(res).toMatchObject({ is_admin: true, admin_level: 'super_admin' })
  })

  it('rejects anything but a boolean', async () => {
    body = { hide_from_search: 'yes' }

    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 })
    expect(db.callsFor('profiles', 'update')).toHaveLength(0)
  })
})
