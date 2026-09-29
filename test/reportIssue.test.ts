import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock } from './helpers/mockSupabase'

// TASK-172 — the public report form takes bugs as well as security issues,
// and says which one each report is.

const g = globalThis as Record<string, unknown>
g.defineEventHandler = (fn: unknown) => fn
g.createError = (opts: { statusCode: number, message: string }) => {
  const err = new Error(opts.message) as Error & { statusCode: number }
  err.statusCode = opts.statusCode
  return err
}
let body: unknown
g.readBody = async () => body
g.getRequestHeader = () => 'test-agent'

let db: ReturnType<typeof createSupabaseMock>

vi.mock('~/server/utils/rateLimit', () => ({ checkRateLimit: vi.fn(async () => true) }))
vi.mock('~/server/utils/clientIp', () => ({ getClientIp: () => '203.0.113.7' }))
vi.mock('~/server/utils/supabaseAdmin', () => ({ useSupabaseAdmin: () => db.client }))

// TASK-175 — the deletion flow sends a session; null means "not signed in".
let session: { id: string, email: string } | null = null
vi.mock('~/server/utils/auth', () => ({
  requireAuth: vi.fn(async () => {
    if (!session) {
      const err = new Error('Unauthorized') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    return { user: session }
  }),
}))

const handler = (await import('~/server/api/security/report.post')).default as (e: unknown) => Promise<unknown>
const message = 'The profile page shows a blank screen on iOS.'

beforeEach(() => {
  db = createSupabaseMock()
  session = null
})

describe('POST /api/security/report — kind', () => {
  it.each(['bug', 'security', 'other'])('stores a %s report with its kind', async (kind) => {
    body = { kind, message }
    await expect(handler({})).resolves.toEqual({ received: true })
    expect(db.callsFor('security_reports', 'insert')[0].args[0]).toMatchObject({ kind, message })
  })

  it('treats a report without a kind as security — the old security-only form', async () => {
    body = { message }
    await handler({})
    expect(db.callsFor('security_reports', 'insert')[0].args[0]).toMatchObject({ kind: 'security' })
  })

  it('rejects an unknown kind', async () => {
    body = { kind: 'feature-request', message }
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 })
    expect(db.callsFor('security_reports', 'insert')).toHaveLength(0)
  })

  it('still swallows honeypot submissions without storing anything', async () => {
    body = { kind: 'bug', message, website: 'http://spam.example' }
    await expect(handler({})).resolves.toEqual({ received: true })
    expect(db.callsFor('security_reports', 'insert')).toHaveLength(0)
  })
})

describe('POST /api/security/report — from the account-deletion dialog (TASK-175)', () => {
  const inserted = () => db.callsFor('security_reports', 'insert')[0]?.args[0] as Record<string, unknown>

  it('records the source, the reason for leaving and the reporter from the session', async () => {
    session = { id: 'user_1', email: 'u@example.com' }
    body = { kind: 'bug', message, source: 'account_deletion', deletion_reason: 'technical_issues', reporter_id: 'someone_else' }

    await handler({})

    expect(inserted()).toMatchObject({ source: 'account_deletion', source_detail: 'technical_issues', reporter_id: 'user_1' })
  })

  it('keeps the email only when the user agreed to be contacted', async () => {
    session = { id: 'user_1', email: 'u@example.com' }
    body = { kind: 'bug', message, source: 'account_deletion', deletion_reason: 'technical_issues', allow_contact: true }
    await handler({})
    expect(inserted().contact).toBe('u@example.com')

    db = createSupabaseMock()
    body = { kind: 'bug', message, source: 'account_deletion', deletion_reason: 'technical_issues', contact: 'typed@x', allow_contact: false }
    await handler({})
    expect(inserted().contact).toBeNull()
  })

  it('requires a signed-in user', async () => {
    body = { kind: 'bug', message, source: 'account_deletion', deletion_reason: 'technical_issues' }
    await expect(handler({})).rejects.toMatchObject({ statusCode: 401 })
    expect(db.callsFor('security_reports', 'insert')).toHaveLength(0)
  })

  it('rejects a reason that is not a deletion reason', async () => {
    session = { id: 'user_1', email: 'u@example.com' }
    body = { kind: 'bug', message, source: 'account_deletion', deletion_reason: 'because' }
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects an unknown source', async () => {
    body = { kind: 'bug', message, source: 'email' }
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 })
  })

  it('keeps a report from the public form anonymous', async () => {
    session = { id: 'user_1', email: 'u@example.com' } // even if signed in
    body = { kind: 'bug', message }
    await handler({})
    expect(inserted()).toMatchObject({ source: 'form', source_detail: null, reporter_id: null })
  })
})
