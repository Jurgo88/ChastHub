import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseMock } from './helpers/mockSupabase'

// The lifecycle helper fires realtime + push side effects; stub them so tests
// stay pure and assert only on the DB writes and the boolean result.
vi.mock('~/server/utils/broadcastLoq', () => ({ broadcastLoqUpdate: vi.fn() }))
vi.mock('~/server/utils/sendPushNotification', () => ({ sendPushNotification: vi.fn() }))

const { maybeExpireLoq } = await import('~/server/utils/expireLoq')

const PAST = new Date(Date.now() - 60_000).toISOString()
const FUTURE = new Date(Date.now() + 60 * 60_000).toISOString()

function baseLoq(overrides: Record<string, unknown> = {}) {
  return {
    id: 'loq_1',
    status: 'active',
    loqee_id: 'loqee_1',
    loqholder_id: 'loqholder_1',
    loqed_until: PAST,
    paused_at: null,
    ...overrides,
  }
}

describe('maybeExpireLoq', () => {
  let db: ReturnType<typeof createSupabaseMock>

  beforeEach(() => {
    db = createSupabaseMock()
  })

  const run = (loq: Record<string, unknown>) =>
    maybeExpireLoq(db.client as unknown as SupabaseClient, loq as never)

  it('ends an active loq whose window has passed', async () => {
    const result = await run(baseLoq({ status: 'active', loqed_until: PAST }))
    expect(result).toBe(true)

    const updates = db.callsFor('loqs', 'update')
    expect(updates).toHaveLength(1)
    expect(updates[0].args[0]).toMatchObject({ status: 'ended', locked: false })
  })

  it('leaves an active loq that has not expired', async () => {
    const result = await run(baseLoq({ status: 'active', loqed_until: FUTURE }))
    expect(result).toBe(false)
    expect(db.callsFor('loqs', 'update')).toHaveLength(0)
  })

  it('ends a paused loq with no remaining time', async () => {
    // loqed_until <= paused_at means zero/negative remaining at pause.
    const result = await run(baseLoq({
      status: 'paused',
      loqed_until: '2026-01-01T00:00:00.000Z',
      paused_at: '2026-01-01T01:00:00.000Z',
    }))
    expect(result).toBe(true)
    expect(db.callsFor('loqs', 'update')).toHaveLength(1)
  })

  it('leaves a paused loq that still has time banked', async () => {
    const result = await run(baseLoq({
      status: 'paused',
      loqed_until: '2026-01-01T02:00:00.000Z',
      paused_at: '2026-01-01T01:00:00.000Z',
    }))
    expect(result).toBe(false)
    expect(db.callsFor('loqs', 'update')).toHaveLength(0)
  })

  it('ends an unattended (draft) expired loq and auto-rejects its pending requests', async () => {
    const result = await run(baseLoq({ status: 'draft', loqholder_id: null, loqed_until: PAST }))
    expect(result).toBe(true)

    expect(db.callsFor('loqs', 'update')).toHaveLength(1)
    const reqUpdates = db.callsFor('loq_requests', 'update')
    expect(reqUpdates).toHaveLength(1)
    expect(reqUpdates[0].args[0]).toMatchObject({ status: 'auto_rejected' })
  })

  it('does not auto-reject requests for an attended (active) loq', async () => {
    await run(baseLoq({ status: 'active', loqed_until: PAST }))
    expect(db.callsFor('loq_requests', 'update')).toHaveLength(0)
  })

  it('leaves a pending loq that has not expired', async () => {
    const result = await run(baseLoq({ status: 'pending', loqholder_id: null, loqed_until: FUTURE }))
    expect(result).toBe(false)
    expect(db.callsFor('loqs', 'update')).toHaveLength(0)
  })

  it('ignores loqs already in a terminal status', async () => {
    const result = await run(baseLoq({ status: 'ended', loqed_until: PAST }))
    expect(result).toBe(false)
    expect(db.from).not.toHaveBeenCalled()
  })

  it('does nothing when loqed_until is missing', async () => {
    const result = await run(baseLoq({ status: 'active', loqed_until: null }))
    expect(result).toBe(false)
    expect(db.callsFor('loqs', 'update')).toHaveLength(0)
  })
})
