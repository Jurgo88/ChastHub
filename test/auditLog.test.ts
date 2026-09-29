import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock } from './helpers/mockSupabase'
import { AUDIT_ACTIONS, AUDIT_ACTION_GROUPS, AUDIT_ACTION_LABELS } from '~/utils/auditActions'

// TASK-169 — the admin audit log.

const g = globalThis as Record<string, unknown>
g.defineEventHandler = (fn: unknown) => fn
g.createError = (opts: { statusCode: number, message: string }) => {
  const err = new Error(opts.message) as Error & { statusCode: number }
  err.statusCode = opts.statusCode
  return err
}
let query: Record<string, string> = {}
g.getQuery = () => query

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

const handler = (await import('~/server/api/admin/audit-log.get')).default as (e: unknown) => Promise<any>
const USER = '11111111-1111-1111-1111-111111111111'

beforeEach(() => {
  db = createSupabaseMock(null, [])
  query = {}
  adminLevel = 'super_admin'
})

describe('GET /api/admin/audit-log', () => {
  it.each(['support', 'analyst', null])('is super_admin only (%s gets 403)', async (level) => {
    adminLevel = level
    await expect(handler({})).rejects.toMatchObject({ statusCode: 403 })
    expect(db.from).not.toHaveBeenCalled()
  })

  it('filters by allow-listed actions only', async () => {
    query = { actions: 'user_banned,admin_demoted,drop table,loq_ended' }
    await handler({})
    expect(db.callsFor('audit_log', 'in')[0].args).toEqual(['action', ['user_banned', 'admin_demoted', 'loq_ended']])
  })

  it('shows everything when no action filter is given', async () => {
    await handler({})
    expect(db.callsFor('audit_log', 'in')).toHaveLength(0)
  })

  it('filters by a user as actor or target', async () => {
    query = { user: USER }
    await handler({})
    expect(db.callsFor('audit_log', 'or')[0].args[0]).toBe(`actor_id.eq.${USER},target_id.eq.${USER}`)
  })

  it('ignores a user filter that is not a UUID, so nothing reaches or() unchecked', async () => {
    query = { user: 'x),id.neq.(0' }
    await handler({})
    expect(db.callsFor('audit_log', 'or')).toHaveLength(0)
  })
})

describe('audit action list', () => {
  it('labels every action the page can filter on', () => {
    for (const a of AUDIT_ACTIONS) expect(AUDIT_ACTION_LABELS[a], a).toBeTruthy()
  })

  it('keeps loq events out of "Admin actions"', () => {
    expect(AUDIT_ACTION_GROUPS.admin.some(a => a.startsWith('loq_'))).toBe(false)
  })

  // A new logAudit() action that is not added to utils/auditActions.ts can
  // only be seen under "All" and cannot be filtered on. Catch that here.
  it('covers every action the server writes to audit_log', () => {
    const written = new Set<string>()
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) { walk(path); continue }
        if (!path.endsWith('.ts') || path.endsWith(join('utils', 'auditLog.ts'))) continue
        const src = readFileSync(path, 'utf8')
        if (!/logAudit\(|from\('audit_log'\)\.insert/.test(src)) continue
        for (const line of src.split('\n')) {
          if (!/logAudit\(|action( =|:)/.test(line)) continue
          for (const m of line.matchAll(/'([a-z]+_[a-z_]+)'/g)) written.add(m[1])
        }
      }
    }
    walk(join(process.cwd(), 'src', 'server'))

    expect(written.size).toBeGreaterThan(10)
    expect([...written].filter(a => !AUDIT_ACTIONS.includes(a))).toEqual([])
  })
})
