import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createSupabaseMock } from './helpers/mockSupabase'
import {
  buildLockSignals, sortAttention, type AttentionItem, type OpenTask, type OpenVerification, type SignalLock,
} from '~/server/utils/lockSignals'
import {
  endsLabel, lockProgress, lockSignalChips, waitingCount, wearerNextUp, wearerToday,
} from '~/utils/lockDashboard'

// Issue #24 — the lock dashboards: per-lock signals, the keyholder's
// "Needs you now" feed and the wearer's "Next up".

const NOW = Date.parse('2026-10-09T12:00:00Z')

const lock = (o: Partial<SignalLock> = {}): SignalLock => ({
  id: 'loq_1', status: 'active', created_at: '2026-10-01T08:00:00Z', checkin_required: false, checkin_tz: 'UTC', ...o,
})

const verification = (o: Partial<OpenVerification> = {}): OpenVerification => ({
  id: 'v1', loq_id: 'loq_1', code: 'AB23', due_at: '2026-10-09T14:00:00Z', penalty_minutes: 60, status: 'pending', submitted_at: null, ...o,
})

const task = (o: Partial<OpenTask> = {}): OpenTask => ({
  id: 't1', loq_id: 'loq_1', text: 'Cold shower', due_at: null, proof: 'none', reward_minutes: 60, penalty_minutes: 120, status: 'open', submitted_at: null, ...o,
})

const checkin = (local_date: string) => ({ loq_id: 'loq_1', local_date, created_at: `${local_date}T09:12:00Z` })

describe('buildLockSignals', () => {
  it('counts what waits on the keyholder', () => {
    const s = buildLockSignals(lock(), [verification({ status: 'submitted', submitted_at: '2026-10-09T11:00:00Z' })], [
      task({ id: 't1', status: 'submitted' }),
      task({ id: 't2', status: 'submitted' }),
      task({ id: 't3' }),
    ], [], NOW)
    expect(s.pending_verifications).toBe(1)
    expect(s.submitted_tasks).toBe(2)
  })

  it('takes the earliest deadline among open tasks only', () => {
    const s = buildLockSignals(lock(), [], [
      task({ id: 'a', due_at: '2026-10-09T20:00:00Z' }),
      task({ id: 'b', due_at: '2026-10-09T15:00:00Z' }),
      task({ id: 'c', due_at: '2026-10-09T13:00:00Z', status: 'submitted' }),
      task({ id: 'd', due_at: null }),
    ], [], NOW)
    expect(s.next_task_due_at).toBe('2026-10-09T15:00:00Z')
    expect(s.open_tasks.map(t => t.id)).toEqual(['c', 'b', 'a', 'd'])
  })

  it('has no deadline when no open task has one', () => {
    expect(buildLockSignals(lock(), [], [task()], [], NOW).next_task_due_at).toBeNull()
  })

  it('reports the latest check-in and whether today is done', () => {
    const s = buildLockSignals(lock(), [], [], [checkin('2026-10-07'), checkin('2026-10-09'), checkin('2026-10-08')], NOW)
    expect(s.last_checkin_at).toBe('2026-10-09T09:12:00Z')
    expect(s.checked_in_today).toBe(true)
  })

  it('flags a missed compulsory check-in: nothing yesterday, nothing yet today', () => {
    const required = lock({ checkin_required: true })
    expect(buildLockSignals(required, [], [], [checkin('2026-10-07')], NOW).missed_checkin).toBe(true)
    expect(buildLockSignals(required, [], [], [checkin('2026-10-08')], NOW).missed_checkin).toBe(false)
    expect(buildLockSignals(required, [], [], [checkin('2026-10-09')], NOW).missed_checkin).toBe(false)
  })

  it('never flags an optional check-in, a paused lock or a lock that did not exist yesterday', () => {
    expect(buildLockSignals(lock(), [], [], [], NOW).missed_checkin).toBe(false)
    expect(buildLockSignals(lock({ checkin_required: true, status: 'paused' }), [], [], [], NOW).missed_checkin).toBe(false)
    expect(buildLockSignals(lock({ checkin_required: true, created_at: '2026-10-09T07:00:00Z' }), [], [], [], NOW).missed_checkin).toBe(false)
  })

  it('counts the day in the wearer\'s time zone', () => {
    // 23:30 on the 9th in UTC is already the 10th in Tokyo.
    const late = Date.parse('2026-10-09T23:30:00Z')
    const s = buildLockSignals(lock({ checkin_tz: 'Asia/Tokyo' }), [], [], [checkin('2026-10-09')], late)
    expect(s.checked_in_today).toBe(false)
  })

  it('exposes the open verification without its lock id', () => {
    const s = buildLockSignals(lock(), [verification()], [], [], NOW)
    expect(s.open_verification).toEqual({ id: 'v1', code: 'AB23', due_at: '2026-10-09T14:00:00Z', penalty_minutes: 60, status: 'pending', submitted_at: null })
    expect(buildLockSignals(lock(), [], [], [], NOW).open_verification).toBeNull()
  })
})

describe('sortAttention', () => {
  const item = (id: string, at: string, kind: AttentionItem['kind'] = 'task'): AttentionItem =>
    ({ kind, id, loq_id: 'loq_1', loqee: null, at })

  it('puts the oldest first, ties broken by id', () => {
    const sorted = sortAttention([
      item('c', '2026-10-09T11:00:00Z'),
      item('b', '2026-10-09T09:00:00Z', 'request'),
      item('a', '2026-10-09T11:00:00Z', 'verification'),
    ])
    expect(sorted.map(i => i.id)).toEqual(['b', 'a', 'c'])
  })
})

describe('lockProgress', () => {
  const times = { created_at: '2026-10-09T00:00:00Z', loqed_until: '2026-10-10T00:00:00Z' }

  it('is the share of the clock already run', () => {
    expect(lockProgress(times, NOW)).toBe(50)
  })

  it('stops at the moment of pausing', () => {
    expect(lockProgress({ ...times, paused_at: '2026-10-09T06:00:00Z' }, NOW)).toBe(25)
  })

  it('stays within 0–100', () => {
    expect(lockProgress(times, Date.parse('2026-10-12T00:00:00Z'))).toBe(100)
    expect(lockProgress(times, Date.parse('2026-10-08T00:00:00Z'))).toBe(0)
    expect(lockProgress({ ...times, loqed_until: null }, NOW)).toBe(0)
  })

  it('writes it under the timer', () => {
    expect(endsLabel({ ...times, paused_at: '2026-10-09T06:00:00Z' }, NOW)).toBe('Paused · 25% done')
    expect(endsLabel(times, NOW)).toMatch(/^Ends .+ · 50% done$/)
  })
})

describe('lockSignalChips', () => {
  it('puts what waits on the keyholder first and caps the count', () => {
    const chips = lockSignalChips({
      pending_verifications: 1, submitted_tasks: 2, missed_checkin: true, checked_in_today: false,
      next_task_due_at: '2026-10-09T20:00:00Z',
    }, 3, NOW)
    expect(chips.map(c => c.label)).toEqual(['Photo to review', '2 task proofs sent', 'Missed check-in'])
    expect(chips.map(c => c.tone)).toEqual(['warn', 'warn', 'due'])
  })

  it('says a passed deadline is overdue', () => {
    expect(lockSignalChips({ next_task_due_at: '2026-10-09T11:00:00Z' }, 3, NOW)[0]).toEqual({ label: 'Task overdue', tone: 'due' })
  })

  it('says all caught up when nothing is going on', () => {
    expect(lockSignalChips({}, 3, NOW)).toEqual([{ label: 'All caught up', tone: 'ok' }])
    expect(lockSignalChips(null)).toEqual([])
  })

  it('counts the waiting items', () => {
    expect(waitingCount({ pending_verifications: 1, submitted_tasks: 2 })).toBe(3)
    expect(waitingCount(undefined)).toBe(0)
  })
})

describe('wearerNextUp', () => {
  const signals = (o = {}) => ({ open_verification: null, open_tasks: [], checked_in_today: false, ...o })

  it('asks for a requested photo first', () => {
    const next = wearerNextUp(signals({
      open_verification: { id: 'v1', code: 'AB23', due_at: '2026-10-09T14:00:00Z', penalty_minutes: 0, status: 'pending', submitted_at: null },
      open_tasks: [task({ due_at: '2026-10-09T13:00:00Z' })],
    }), true)
    expect(next).toMatchObject({ target: 'verification', code: 'AB23', action: 'Take photo' })
  })

  it('then the task with a deadline, then a compulsory check-in, then any open task', () => {
    const dated = task({ id: 't2', text: 'Journal', due_at: '2026-10-09T20:00:00Z', proof: 'text' })
    expect(wearerNextUp(signals({ open_tasks: [task(), dated] }), true)).toMatchObject({ target: 'task', title: 'Journal', action: 'Mark as done' })
    expect(wearerNextUp(signals({ open_tasks: [task()] }), true)).toMatchObject({ target: 'checkin' })
    expect(wearerNextUp(signals({ open_tasks: [task()], checked_in_today: true }), true)).toMatchObject({ target: 'task', title: 'Cold shower' })
  })

  it('skips what is already sent and has nothing when all is done', () => {
    const sent = signals({
      open_verification: { id: 'v1', code: 'AB23', due_at: '2026-10-09T14:00:00Z', penalty_minutes: 0, status: 'submitted', submitted_at: null },
      open_tasks: [task({ status: 'submitted' })],
      checked_in_today: true,
    })
    expect(wearerNextUp(sent, true)).toBeNull()
    expect(wearerNextUp(signals(), false)).toBeNull()
  })
})

describe('wearerToday', () => {
  it('lists the check-in, the photo and the tasks with their state', () => {
    const items = wearerToday({
      checked_in_today: true,
      last_checkin_at: '2026-10-09T09:12:00Z',
      open_verification: { id: 'v1', code: 'AB23', due_at: '2026-10-09T14:00:00Z', penalty_minutes: 0, status: 'submitted', submitted_at: null },
      open_tasks: [task({ due_at: '2026-10-09T20:00:00Z' })],
    }, true, NOW)
    expect(items.map(i => [i.target, i.state])).toEqual([['checkin', 'done'], ['verification', 'waiting'], ['task', 'todo']])
  })

  it('marks the check-in as required or optional', () => {
    expect(wearerToday({ checked_in_today: false }, true, NOW)[0].meta).toBe('Required')
    expect(wearerToday({ checked_in_today: false }, false, NOW)[0].meta).toBe('Optional')
  })
})

// ─── GET /api/loqholders/attention ──────────────────────────────────────────

const g = globalThis as Record<string, unknown>
g.defineEventHandler = (fn: unknown) => fn
g.createError = (opts: { statusCode: number, message: string }) => {
  const err = new Error(opts.message) as Error & { statusCode: number }
  err.statusCode = opts.statusCode
  return err
}

let db: ReturnType<typeof createSupabaseMock>
let role = 'loqholder'

vi.mock('~/server/utils/auth', () => ({
  requireAuth: vi.fn(async () => ({ user: { id: 'kh_1' }, role })),
}))
vi.mock('~/server/utils/supabaseAdmin', () => ({
  useSupabaseAdmin: () => db.client,
}))

const handler = (await import('~/server/api/loqholders/attention.get')).default as
  (event: unknown) => Promise<{ items: AttentionItem[]; total: number }>

describe('GET /api/loqholders/attention', () => {
  beforeEach(() => {
    role = 'loqholder'
    db = createSupabaseMock(null, [])
  })

  it('is for keyholders only', async () => {
    role = 'loqee'
    await expect(handler({})).rejects.toMatchObject({ statusCode: 403 })
  })

  it('reads only the caller\'s own running locks and requests', async () => {
    await handler({})
    expect(db.callsFor('loqs', 'eq')).toContainEqual({ table: 'loqs', method: 'eq', args: ['loqholder_id', 'kh_1'] })
    expect(db.callsFor('loqs', 'in')).toContainEqual({ table: 'loqs', method: 'in', args: ['status', ['active', 'paused']] })
    expect(db.callsFor('loq_requests', 'eq')).toContainEqual({ table: 'loq_requests', method: 'eq', args: ['loqholder_id', 'kh_1'] })
  })

  it('does not look for photos or tasks without a lock', async () => {
    const res = await handler({})
    expect(res).toEqual({ items: [], total: 0 })
    expect(db.callsFor('loq_verifications', 'select')).toHaveLength(0)
    expect(db.callsFor('loq_tasks', 'select')).toHaveLength(0)
  })

  it('asks only for submitted photos and tasks of those locks', async () => {
    db = createSupabaseMock(null, [{ id: 'loq_1', loqee: null }])
    await handler({})
    expect(db.callsFor('loq_verifications', 'in')).toContainEqual({ table: 'loq_verifications', method: 'in', args: ['loq_id', ['loq_1']] })
    expect(db.callsFor('loq_verifications', 'eq')).toContainEqual({ table: 'loq_verifications', method: 'eq', args: ['status', 'submitted'] })
    expect(db.callsFor('loq_tasks', 'eq')).toContainEqual({ table: 'loq_tasks', method: 'eq', args: ['status', 'submitted'] })
  })
})
