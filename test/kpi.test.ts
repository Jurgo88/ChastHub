import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock } from './helpers/mockSupabase'

// TASK-160 — the heartbeat records a day of activity only when the app is on
// screen, never lets analytics break presence, and the KPI endpoint is
// open to every admin level (TASK-182).

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
let rpc: ReturnType<typeof vi.fn>
let adminLevel: string | null = 'super_admin'

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
vi.mock('~/server/utils/supabaseAdmin', () => ({
  useSupabaseAdmin: () => ({ ...db.client, rpc }),
}))

const heartbeat = (await import('~/server/api/profile/heartbeat.post')).default as (e: unknown) => Promise<unknown>
const kpi = (await import('~/server/api/admin/kpi.get')).default as (e: unknown) => Promise<unknown>

beforeEach(() => {
  db = createSupabaseMock()
  rpc = vi.fn(async () => ({ data: null, error: null }))
  body = undefined
  adminLevel = 'super_admin'
})

describe('POST /api/profile/heartbeat', () => {
  it('records a day of activity when the app is on screen', async () => {
    body = { visible: true }
    await heartbeat({})

    expect(rpc).toHaveBeenCalledWith('record_user_activity', { p_user_id: 'me' })
    expect(db.callsFor('profiles', 'update')).toHaveLength(1)
  })

  it('keeps last seen fresh but records no activity from a background tab', async () => {
    body = { visible: false }
    await heartbeat({})

    expect(rpc).not.toHaveBeenCalled()
    expect(db.callsFor('profiles', 'update')).toHaveLength(1)
  })

  it('counts a client that sends no body, which predates the flag', async () => {
    await heartbeat({})

    expect(rpc).toHaveBeenCalledOnce()
  })

  it('still answers ok when recording activity fails', async () => {
    rpc = vi.fn(async () => ({ data: null, error: { message: 'function does not exist' } }))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(heartbeat({})).resolves.toEqual({ ok: true })
    spy.mockRestore()
  })
})

describe('GET /api/admin/kpi', () => {
  // TASK-182 — every admin level sees the product KPIs; non-admins do not.
  it.each(['analyst', 'support', 'super_admin'])('is open to %s admins', async (level) => {
    adminLevel = level
    await expect(kpi({})).resolves.toBeDefined()
  })

  it('refuses anyone who is not an admin', async () => {
    adminLevel = null
    await expect(kpi({})).rejects.toMatchObject({ statusCode: 403 })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('returns what admin_kpi() computed, with the signup sources alongside', async () => {
    rpc = vi.fn(async (fn: string) => ({
      data: fn === 'admin_kpi' ? { users: 3 } : { signups: 2, no_source: 1 },
      error: null,
    }))

    await expect(kpi({})).resolves.toEqual({ users: 3, sources: { signups: 2, no_source: 1 } })
    expect(rpc).toHaveBeenCalledWith('admin_kpi')
    expect(rpc).toHaveBeenCalledWith('admin_signup_sources')
  })

  // TASK-165 — before migration 068 the sources block is absent, the rest shows.
  it('still returns the KPIs when the sources function is missing', async () => {
    rpc = vi.fn(async (fn: string) => fn === 'admin_kpi'
      ? { data: { users: 3 }, error: null }
      : { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.admin_signup_sources' } })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(kpi({})).resolves.toEqual({ users: 3, sources: null })
    spy.mockRestore()
  })

  it('says to apply the migration when the function is missing', async () => {
    rpc = vi.fn(async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.admin_kpi' } }))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(kpi({})).rejects.toMatchObject({ statusCode: 500, message: expect.stringContaining('migration 065') })
    spy.mockRestore()
  })
})
