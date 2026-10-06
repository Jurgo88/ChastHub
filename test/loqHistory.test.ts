import { describe, expect, it } from 'vitest'
import {
  buildHistory, buildSummary, filterHistory, lockOutcome, type AuditRow, type LockHistoryRow, type VisitorRow,
} from '~/server/utils/loqHistory'

const KH = 'keyholder_1'
const WR = 'wearer_1'

function lock(overrides: Partial<LockHistoryRow> = {}): LockHistoryRow {
  return {
    id: 'loq_1',
    loqee_id: WR,
    loqholder_id: KH,
    status: 'ended',
    created_at: '2026-10-01T00:00:00Z',
    accepted_at: '2026-10-01T01:00:00Z',
    loqed_until: '2026-10-11T00:00:00Z',
    ended_at: '2026-10-11T00:00:00Z',
    paused_at: null,
    combination_revealed_at: null,
    ...overrides,
  }
}

const audit = (action: string, at: string, actor = KH, details: Record<string, unknown> = {}): AuditRow =>
  ({ action, actor_id: actor, created_at: at, details })

const visit = (at: string, direction: 'add' | 'remove' = 'add', hours = 1): VisitorRow =>
  ({ direction, hours_added: hours, created_at: at })

describe('buildHistory', () => {
  it('lists creation, acceptance, time changes, pauses and the end, oldest first', () => {
    const events = buildHistory(lock(), [
      audit('loq_resumed', '2026-10-05T10:20:00Z'),
      audit('loq_accepted', '2026-10-01T01:00:00Z'),
      audit('loq_time_added', '2026-10-03T12:00:00Z', KH, { delta_minutes: 360 }),
      audit('loq_paused', '2026-10-05T10:00:00Z', WR),
      audit('loq_ended', '2026-10-11T00:00:00Z'),
    ], [])
    expect(events.map(e => e.type)).toEqual(['created', 'accepted', 'time_added', 'paused', 'resumed', 'ended'])
    expect(events[2]).toMatchObject({ actor: 'keyholder', delta_minutes: 360 })
    expect(events[3]!.actor).toBe('wearer')
  })

  it('reports a negative adjustment as removed time and ignores a malformed one', () => {
    const events = buildHistory(lock({ status: 'active' }), [
      audit('loq_time_removed', '2026-10-02T00:00:00Z', KH, { delta_minutes: -120 }),
      audit('loq_time_added', '2026-10-02T01:00:00Z', KH, {}),
    ], [])
    expect(events.filter(e => e.type !== 'created')).toEqual([
      { type: 'time_removed', at: '2026-10-02T00:00:00Z', actor: 'keyholder', delta_minutes: -120 },
    ])
  })

  it('keeps up to three visitor moves a day as separate lines and merges more', () => {
    const three = buildHistory(lock({ status: 'active' }), [], [
      visit('2026-10-02T08:00:00Z'), visit('2026-10-02T09:00:00Z'), visit('2026-10-02T10:00:00Z'),
    ])
    expect(three.filter(e => e.type === 'visitors_added')).toHaveLength(3)

    const five = buildHistory(lock({ status: 'active' }), [], [
      visit('2026-10-02T08:00:00Z'), visit('2026-10-02T09:00:00Z'), visit('2026-10-02T10:00:00Z'),
      visit('2026-10-02T11:00:00Z'), visit('2026-10-02T12:00:00Z'),
      visit('2026-10-03T08:00:00Z'),
    ])
    const merged = five.filter(e => e.type === 'visitors_added')
    expect(merged).toHaveLength(2)
    expect(merged[0]).toMatchObject({ count: 5, delta_minutes: 300, at: '2026-10-02T12:00:00Z' })
    expect(merged[1]).toMatchObject({ count: 1, delta_minutes: 60 })
  })

  it('never merges adds with removes and never carries a visitor identity', () => {
    const events = buildHistory(lock({ status: 'active' }), [], [
      visit('2026-10-02T08:00:00Z', 'add'), visit('2026-10-02T09:00:00Z', 'remove', 2),
    ])
    expect(events.filter(e => e.type === 'visitors_removed')[0]).toMatchObject({ delta_minutes: -120 })
    expect(JSON.stringify(events)).not.toMatch(/user_id|ip_hash|name/)
  })

  it('adds an ended event for a lock that ran out by itself and shows the reveal without the code', () => {
    const events = buildHistory(lock({ combination_revealed_at: '2026-10-11T00:05:00Z' }), [], [])
    expect(events.map(e => e.type)).toEqual(['created', 'ended', 'revealed'])
    expect(JSON.stringify(events)).not.toMatch(/combination_text/)
  })

  it('includes check-ins', () => {
    const events = buildHistory(lock({ status: 'active' }), [], [], [{ mood: 'proud', created_at: '2026-10-02T20:00:00Z' }])
    expect(events.at(-1)).toMatchObject({ type: 'checkin', mood: 'proud', actor: 'wearer' })
  })
})

describe('filterHistory', () => {
  const events = buildHistory(lock({ status: 'active' }), [
    audit('loq_time_added', '2026-10-02T00:00:00Z', KH, { delta_minutes: 60 }),
    audit('loq_paused', '2026-10-03T00:00:00Z'),
    audit('loq_resumed', '2026-10-03T01:00:00Z'),
  ], [visit('2026-10-04T00:00:00Z')])

  it('narrows by group', () => {
    expect(filterHistory(events, 'all')).toHaveLength(events.length)
    expect(filterHistory(events, 'time').map(e => e.type)).toEqual(['time_added', 'visitors_added'])
    expect(filterHistory(events, 'pauses').map(e => e.type)).toEqual(['paused', 'resumed'])
    expect(filterHistory(events, 'visitors').map(e => e.type)).toEqual(['visitors_added'])
  })
})

describe('lockOutcome', () => {
  it('tells how a lock ended', () => {
    expect(lockOutcome({ status: 'active', ended_at: null, loqed_until: null })).toBe('running')
    expect(lockOutcome({ status: 'cancelled', ended_at: null, loqed_until: null })).toBe('cancelled')
    expect(lockOutcome({ status: 'ended', ended_at: '2026-10-11T00:00:00Z', loqed_until: '2026-10-11T00:00:00Z' })).toBe('completed')
    expect(lockOutcome({ status: 'ended', ended_at: '2026-10-06T00:00:00Z', loqed_until: '2026-10-11T00:00:00Z' })).toBe('ended_early')
  })
})

describe('buildSummary', () => {
  it('counts time by who added it, pauses, and the longest run without a pause', () => {
    const l = lock()
    const events = buildHistory(l, [
      audit('loq_time_added', '2026-10-02T00:00:00Z', KH, { delta_minutes: 360 }),
      audit('loq_time_removed', '2026-10-02T01:00:00Z', KH, { delta_minutes: -60 }),
      audit('loq_paused', '2026-10-04T00:00:00Z'),
      audit('loq_resumed', '2026-10-04T01:00:00Z'),
    ], [visit('2026-10-03T00:00:00Z', 'add', 2), visit('2026-10-03T01:00:00Z', 'remove', 1)])

    const s = buildSummary(l, events, 2)
    expect(s).toMatchObject({
      outcome: 'completed',
      total_hours: 240,
      keyholder_added_hours: 6,
      keyholder_removed_hours: 1,
      visitor_added_hours: 2,
      visitor_removed_hours: 1,
      visitors: 2,
      pauses: 1,
    })
    // Start to the pause is 3 days, the resume to the end is ~6 days 23h.
    expect(s.longest_stretch_hours).toBe(167)
  })

  it('uses the same total as the Stats page: a running lock runs until now', () => {
    const l = lock({ status: 'active', ended_at: null, loqed_until: '2026-10-11T00:00:00Z' })
    const now = new Date('2026-10-02T00:00:00Z').getTime()
    const s = buildSummary(l, buildHistory(l, [], []), 0, now)
    expect(s.total_hours).toBe(24)
    expect(s.longest_stretch_hours).toBe(24)
  })
})
