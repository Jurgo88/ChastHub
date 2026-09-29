import { describe, it, expect, vi, beforeEach } from 'vitest'

// TASK-170 — a user's DMs and loq chats for the admin user page.

const g = globalThis as Record<string, unknown>
g.defineEventHandler = (fn: unknown) => fn
g.createError = (opts: { statusCode: number, message: string }) => {
  const err = new Error(opts.message) as Error & { statusCode: number }
  err.statusCode = opts.statusCode
  return err
}
const ME = '11111111-1111-1111-1111-111111111111'
let routeId = ME
g.getRouterParam = () => routeId

let adminLevel: string | null = 'support'
let tables: Record<string, unknown[]> = {}
const calls: { table: string, method: string, args: unknown[] }[] = []

// One awaitable builder per from(), resolving to that table's rows.
function from(table: string) {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'or', 'order', 'limit']) {
    b[m] = (...args: unknown[]) => { calls.push({ table, method: m, args }); return b }
  }
  b.then = (resolve: (v: unknown) => unknown) => resolve({ data: tables[table] ?? [], error: null })
  return b
}

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
vi.mock('~/server/utils/supabaseAdmin', () => ({ useSupabaseAdmin: () => ({ from }) }))

const handler = (await import('~/server/api/admin/users/[id]/conversations.get')).default as (e: unknown) => Promise<any>

const alice = { id: 'a', display_name: 'Alice', email: 'a@x' }
const bob = { id: 'b', display_name: 'Bob', email: 'b@x' }
const me = { id: ME, display_name: 'Me', email: 'me@x' }

beforeEach(() => {
  routeId = ME
  adminLevel = 'support'
  calls.length = 0
  tables = {}
})

describe('GET /api/admin/users/[id]/conversations', () => {
  it('names the other party and counts messages, whichever side the user is on', async () => {
    tables = {
      conversations: [
        { id: 'c1', status: 'accepted', created_at: 't', last_message_at: 't2', user_a_id: ME, user_a: me, user_b: alice, dm_messages: [{ count: 7 }] },
        { id: 'c2', status: 'pending', created_at: 't', last_message_at: null, user_a_id: 'b', user_a: bob, user_b: me, dm_messages: [{ count: 1 }] },
      ],
      loqs: [
        { id: 'l1', status: 'active', created_at: 't', loqee_id: ME, loqee: me, loqholder: alice, messages: [{ count: 3 }] },
        { id: 'l2', status: 'pending', created_at: 't', loqee_id: ME, loqee: me, loqholder: null, messages: [] },
        { id: 'l3', status: 'ended', created_at: 't', loqee_id: 'b', loqee: bob, loqholder: me, messages: [{ count: 0 }] },
      ],
    }

    const res = await handler({})

    expect(res.dms.map((d: any) => [d.id, d.other?.id, d.messages])).toEqual([['c1', 'a', 7], ['c2', 'b', 1]])
    expect(res.loqs.map((l: any) => [l.id, l.role, l.other?.id ?? null, l.messages]))
      .toEqual([['l1', 'loqee', 'a', 3], ['l2', 'loqee', null, 0], ['l3', 'loqholder', 'b', 0]])
  })

  it('looks the user up on either side of both tables', async () => {
    await handler({})
    const ors = calls.filter(c => c.method === 'or').map(c => [c.table, c.args[0]])
    expect(ors).toEqual([
      ['conversations', `user_a_id.eq.${ME},user_b_id.eq.${ME}`],
      ['loqs', `loqee_id.eq.${ME},loqholder_id.eq.${ME}`],
    ])
  })

  it('answers 404 for a malformed id, so nothing reaches or()', async () => {
    routeId = 'x,id.neq.0'
    await expect(handler({})).rejects.toMatchObject({ statusCode: 404 })
    expect(calls).toHaveLength(0)
  })

  it('is for support and super admins only', async () => {
    adminLevel = 'analyst'
    await expect(handler({})).rejects.toMatchObject({ statusCode: 403 })
  })
})
