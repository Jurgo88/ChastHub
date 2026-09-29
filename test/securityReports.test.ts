import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock } from './helpers/mockSupabase'

// TASK-168 — the admin inbox for reports from the public form (TASK-173:
// bugs too, filtered by kind).

const g = globalThis as Record<string, unknown>
g.defineEventHandler = (fn: unknown) => fn
g.createError = (opts: { statusCode: number, message: string }) => {
  const err = new Error(opts.message) as Error & { statusCode: number }
  err.statusCode = opts.statusCode
  return err
}
let query: Record<string, string> = {}
let body: unknown
let routeId = '11111111-1111-1111-1111-111111111111'
g.getQuery = () => query
g.readBody = async () => body
g.getRouterParam = () => routeId

let db: ReturnType<typeof createSupabaseMock>
let adminLevel: string | null = 'super_admin'

vi.mock('~/server/utils/auth', () => ({
  requireAuth: vi.fn(async () => ({ user: { id: 'admin_1' }, adminLevel })),
  requireAdminLevel: vi.fn((level: string | null, levels: string[]) => {
    if (!level || !levels.includes(level)) {
      const err = new Error('Forbidden') as Error & { statusCode: number }
      err.statusCode = 403
      throw err
    }
  }),
}))
vi.mock('~/server/utils/supabaseAdmin', () => ({
  useSupabaseAdmin: () => db.client,
}))

const list = (await import('~/server/api/admin/security-reports/index.get')).default as (e: unknown) => Promise<any>
const handle = (await import('~/server/api/admin/security-reports/[id]/handle.post')).default as (e: unknown) => Promise<any>

beforeEach(() => {
  db = createSupabaseMock({ id: routeId }, [])
  query = {}
  body = undefined
  routeId = '11111111-1111-1111-1111-111111111111'
  adminLevel = 'super_admin'
})

describe('GET /api/admin/security-reports', () => {
  it.each(['support', 'analyst', null])('is super_admin only (%s gets 403)', async (level) => {
    adminLevel = level
    await expect(list({})).rejects.toMatchObject({ statusCode: 403 })
    expect(db.from).not.toHaveBeenCalled()
  })

  it('lists open reports by default', async () => {
    await list({})
    expect(db.callsFor('security_reports', 'is').some(c => c.args[0] === 'handled_at' && c.args[1] === null)).toBe(true)
  })

  // TASK-173 — the form takes bugs too.
  it('filters by kind', async () => {
    query = { kind: 'bug' }
    await list({})
    expect(db.callsFor('security_reports', 'eq').some(c => c.args[0] === 'kind' && c.args[1] === 'bug')).toBe(true)
  })

  it('ignores an unknown kind rather than filtering on it', async () => {
    query = { kind: 'spam' }
    await list({})
    expect(db.callsFor('security_reports', 'eq').some(c => c.args[0] === 'kind' && c.args[1] === 'spam')).toBe(false)
  })

  it('counts open security reports on their own', async () => {
    const res = await list({})
    expect(res).toHaveProperty('open_security')
    expect(db.callsFor('security_reports', 'eq').some(c => c.args[0] === 'kind' && c.args[1] === 'security')).toBe(true)
  })

  // TASK-177 — reports sent while deleting an account.
  it('filters to reports sent while leaving', async () => {
    query = { source: 'account_deletion' }
    await list({})
    expect(db.callsFor('security_reports', 'eq').some(c => c.args[0] === 'source' && c.args[1] === 'account_deletion')).toBe(true)
  })

  it('ignores an unknown source', async () => {
    query = { source: 'email' }
    await list({})
    expect(db.callsFor('security_reports', 'eq').some(c => c.args[0] === 'source')).toBe(false)
  })

  it('returns the source, the reason and the reporter', async () => {
    await list({})
    const select = String(db.callsFor('security_reports', 'select')[0].args[0])
    expect(select).toContain('source, source_detail')
    expect(select).toContain('reporter:profiles!reporter_id')
  })

  it('lists handled reports on request', async () => {
    query = { status: 'handled' }
    await list({})
    expect(db.callsFor('security_reports', 'not')[0].args).toEqual(['handled_at', 'is', null])
  })
})

describe('POST /api/admin/security-reports/[id]/handle', () => {
  it('marks a report handled, with who and the note, and audits it', async () => {
    body = { handled: true, note: '  fixed in #123  ' }

    await expect(handle({})).resolves.toEqual({ success: true })

    const update = db.callsFor('security_reports', 'update')[0].args[0] as Record<string, unknown>
    expect(update).toMatchObject({ handled_by: 'admin_1', admin_note: 'fixed in #123' })
    expect(typeof update.handled_at).toBe('string')
    const audit = db.callsFor('audit_log', 'insert')[0].args[0] as Record<string, any>
    expect(audit).toMatchObject({ action: 'security_report_handled', actor_id: 'admin_1' })
    expect(audit.details.security_report_id).toBe(routeId)
  })

  it('reopens a report and keeps its note as history', async () => {
    body = { handled: false }

    await handle({})

    expect(db.callsFor('security_reports', 'update')[0].args[0]).toEqual({ handled_at: null, handled_by: null })
    expect(db.callsFor('audit_log', 'insert')[0].args[0]).toMatchObject({ action: 'security_report_reopened' })
  })

  it('rejects a non-boolean handled flag', async () => {
    body = { handled: 'yes' }
    await expect(handle({})).rejects.toMatchObject({ statusCode: 400 })
    expect(db.callsFor('security_reports', 'update')).toHaveLength(0)
  })

  it('answers 404 for a malformed id or a report that does not exist', async () => {
    routeId = 'not-a-uuid'
    body = { handled: true }
    await expect(handle({})).rejects.toMatchObject({ statusCode: 404 })

    routeId = '22222222-2222-2222-2222-222222222222'
    db = createSupabaseMock(null)
    await expect(handle({})).rejects.toMatchObject({ statusCode: 404 })
    expect(db.callsFor('audit_log', 'insert')).toHaveLength(0)
  })

  it('is super_admin only', async () => {
    adminLevel = 'support'
    body = { handled: true }
    await expect(handle({})).rejects.toMatchObject({ statusCode: 403 })
  })
})
