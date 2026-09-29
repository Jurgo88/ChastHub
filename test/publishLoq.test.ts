import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock } from './helpers/mockSupabase'

// TASK-145 — publishing lists the loq in Discover, and everything about a
// listed loq is keyed by public_link_id: the card links to
// /loq/<public_link_id>, the vote posts to /api/loq/<public_link_id>/adjust-time.
// Only self-loqs get one at creation, so publishing has to fill the gap.
// It did not, and the card came out pointing at /loq/null — pressing "add
// time" answered "Loq not found".

const g = globalThis as Record<string, unknown>
g.defineEventHandler = (fn: unknown) => fn
g.createError = (opts: { statusCode: number, message: string }) => {
  const err = new Error(opts.message) as Error & { statusCode: number }
  err.statusCode = opts.statusCode
  return err
}
g.getRouterParam = () => 'loq_1'

let db: ReturnType<typeof createSupabaseMock>

vi.mock('~/server/utils/auth', () => ({
  requireAuth: vi.fn(async () => ({ user: { id: 'owner_1' }, role: 'loqee' })),
  requireActiveSubscription: vi.fn(async () => {}),
}))
vi.mock('~/server/utils/supabaseAdmin', () => ({
  useSupabaseAdmin: () => db.client,
}))

const handler = (await import('~/server/api/loqs/[id]/publish.post')).default as
  (event: unknown) => Promise<unknown>

function loq(overrides: Record<string, unknown> = {}) {
  return { id: 'loq_1', loqee_id: 'owner_1', status: 'draft', public_link_id: null, ...overrides }
}

describe('POST /api/loqs/[id]/publish', () => {
  beforeEach(() => {
    db = createSupabaseMock(loq())
  })

  it('gives the loq a link, without which its Discover card is dead', async () => {
    await handler({})

    const [update] = db.callsFor('loqs', 'update')
    const payload = update.args[0] as Record<string, unknown>
    expect(payload.listed_in_discover).toBe(true)
    expect(payload.public_link_id).toMatch(/^[0-9a-f]{32}$/)
  })

  // TASK-186 — when the loq started looking for a loqholder.
  it('stamps published_at when a draft is first published', async () => {
    await handler({})

    const payload = db.callsFor('loqs', 'update')[0].args[0] as Record<string, unknown>
    expect(typeof payload.published_at).toBe('string')
  })

  it('does not move published_at when an already pending loq is published again', async () => {
    db = createSupabaseMock(loq({ status: 'pending', public_link_id: 'existinglink00000000000000000000' }))

    await handler({})

    const payload = db.callsFor('loqs', 'update')[0].args[0] as Record<string, unknown>
    expect(payload).not.toHaveProperty('published_at')
  })

  it('keeps the link a loq already has, so shared URLs stay valid', async () => {
    db = createSupabaseMock(loq({ public_link_id: 'existinglink00000000000000000000' }))

    await handler({})

    const [update] = db.callsFor('loqs', 'update')
    expect((update.args[0] as Record<string, unknown>).public_link_id)
      .toBe('existinglink00000000000000000000')
  })
})
