import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock } from './helpers/mockSupabase'

// TASK-159 — People search finds subscribers' results by display name too.
// Most accounts have no username, so a handle-only search could not reach
// them; everyone else keeps the handle lookup, and nobody searches by email.

const g = globalThis as Record<string, unknown>
g.defineEventHandler = (fn: unknown) => fn
g.createError = (opts: { statusCode: number, message: string }) => {
  const err = new Error(opts.message) as Error & { statusCode: number }
  err.statusCode = opts.statusCode
  return err
}
let q = ''
g.getQuery = () => ({ q })

let db: ReturnType<typeof createSupabaseMock>

vi.mock('~/server/utils/auth', () => ({
  requireAuth: vi.fn(async () => ({ user: { id: 'me' } })),
}))
vi.mock('~/server/utils/supabaseAdmin', () => ({
  useSupabaseAdmin: () => db.client,
}))

const handler = (await import('~/server/api/profiles/search.get')).default as
  (event: unknown) => Promise<{ profiles: { id: string }[], by_name: boolean }>

const subscriber = { subscription_status: 'active', is_admin: false }
const free = { subscription_status: 'inactive', is_admin: false }

function person(id: string, username: string | null, display_name: string) {
  return { id, username, display_name, avatar_url: null, role: 'loqee' }
}

describe('GET /api/profiles/search', () => {
  beforeEach(() => { q = '' })

  it('lets a subscriber match the display name, not only the handle', async () => {
    q = 'nov'
    db = createSupabaseMock(subscriber, [])

    const res = await handler({})

    expect(res.by_name).toBe(true)
    const [or] = db.callsFor('profiles', 'or')
    expect(or.args[0]).toBe('username.ilike."nov%",display_name.ilike."%nov%"')
    expect(db.callsFor('profiles', 'ilike')).toHaveLength(0)
  })

  it('keeps a non-subscriber on the handle-prefix lookup', async () => {
    q = 'nov'
    db = createSupabaseMock(free, [])

    const res = await handler({})

    expect(res.by_name).toBe(false)
    expect(db.callsFor('profiles', 'or')).toHaveLength(0)
    expect(db.callsFor('profiles', 'ilike')[0].args).toEqual(['username', 'nov%'])
  })

  it('never searches by email and never returns banned, deleted or self', async () => {
    q = 'jan'
    db = createSupabaseMock(subscriber, [])

    await handler({})

    const filters = db.calls.map(c => JSON.stringify(c.args)).join(' ')
    expect(filters).not.toContain('email')
    expect(db.callsFor('profiles', 'eq').some(c => c.args[0] === 'status' && c.args[1] === 'active')).toBe(true)
    expect(db.callsFor('profiles', 'neq').some(c => c.args[0] === 'id' && c.args[1] === 'me')).toBe(true)
  })

  // TASK-161 — "Show me in search" off hides the account from both searches.
  it.each([['subscriber', subscriber], ['non-subscriber', free]])(
    'leaves out users who opted out of search (%s)',
    async (_label, me) => {
      q = 'jan'
      db = createSupabaseMock(me, [])

      await handler({})

      expect(db.callsFor('profiles', 'eq').some(c => c.args[0] === 'hide_from_search' && c.args[1] === false)).toBe(true)
    },
  )

  it('ranks an exact handle over a handle prefix over a name match', async () => {
    q = 'jan'
    db = createSupabaseMock(subscriber, [
      person('contains', null, 'Marijan K'),
      person('word', null, 'Peter Jancik'),
      person('nameStart', null, 'Janka'),
      person('prefix', 'janko', 'Someone'),
      person('exact', 'jan', 'Other'),
    ])

    const res = await handler({})

    expect(res.profiles.map(p => p.id)).toEqual(['exact', 'prefix', 'nameStart', 'word', 'contains'])
  })

  it('drops characters that would act as wildcards or break the filter', async () => {
    q = '@ja"n%*\\'
    db = createSupabaseMock(subscriber, [])

    await handler({})

    expect(db.callsFor('profiles', 'or')[0].args[0]).toBe('username.ilike."jan%",display_name.ilike."%jan%"')
  })
})
