import { describe, expect, it } from 'vitest'
import {
  autoApproveDue, canTransitionTask, doneMessage, effectiveReward, failedMessage, isMissed, isOpenTask, newTaskMessage,
  parseDue, parseTaskInput, taskReminderDue, taskPhotoPath,
} from '~/server/utils/tasks'
import { shiftedUntil } from '~/server/utils/lockTime'
import { buildHistory, type LockHistoryRow } from '~/server/utils/loqHistory'
import { deadlineFor, tonight, tomorrowEvening } from '~/utils/taskDeadlines'

const NOW = Date.parse('2026-10-09T12:00:00Z')

describe('parseTaskInput', () => {
  it('accepts a full task and tidies the text', () => {
    expect(parseTaskInput({ text: '  Do   30 squats ', proof: 'text', reward_minutes: 60, penalty_minutes: 120 }))
      .toEqual({ text: 'Do 30 squats', proof: 'text', reward_minutes: 60, penalty_minutes: 120 })
  })

  it('fills in defaults', () => {
    expect(parseTaskInput({ text: 'Cold shower' })).toEqual({ text: 'Cold shower', proof: 'none', reward_minutes: 0, penalty_minutes: 0 })
  })

  it('refuses bad text', () => {
    expect(typeof parseTaskInput({ text: 'x' })).toBe('string')
    expect(typeof parseTaskInput({ text: 'a'.repeat(301) })).toBe('string')
    expect(parseTaskInput({ text: 'go to https://example.com' })).toBe('Links are not allowed in tasks')
    expect(parseTaskInput({ text: 'check onlyfans.com' })).toBe('Links are not allowed in tasks')
    expect(typeof parseTaskInput(null)).toBe('string')
  })

  it('refuses out-of-range rewards, penalties and proofs', () => {
    expect(typeof parseTaskInput({ text: 'ok task', reward_minutes: 1441 })).toBe('string')
    expect(typeof parseTaskInput({ text: 'ok task', penalty_minutes: 4321 })).toBe('string')
    expect(typeof parseTaskInput({ text: 'ok task', penalty_minutes: 1.5 })).toBe('string')
    expect(typeof parseTaskInput({ text: 'ok task', reward_minutes: -1 })).toBe('string')
    expect(typeof parseTaskInput({ text: 'ok task', proof: 'video' })).toBe('string')
  })
})

describe('parseDue', () => {
  it('allows no deadline', () => {
    expect(parseDue(undefined, NOW)).toBeNull()
    expect(parseDue('', NOW)).toBeNull()
  })

  it('needs a future date within 30 days', () => {
    expect(parseDue('2026-10-09T14:00:00Z', NOW)).toBe('2026-10-09T14:00:00.000Z')
    expect(parseDue('2026-10-09T11:00:00Z', NOW)).toEqual({ error: 'The deadline must be in the future' })
    expect(parseDue('2026-12-01T00:00:00Z', NOW)).toEqual({ error: 'The deadline can be at most 30 days ahead' })
    expect(parseDue('tomorrow', NOW)).toEqual({ error: 'due_at must be a date' })
  })
})

describe('state transitions', () => {
  it('lets an open task be submitted, settled or withdrawn', () => {
    for (const to of ['submitted', 'done', 'failed', 'cancelled'] as const) expect(canTransitionTask('open', to)).toBe(true)
  })

  it('lets a submitted task only be settled', () => {
    expect(canTransitionTask('submitted', 'done')).toBe(true)
    expect(canTransitionTask('submitted', 'failed')).toBe(true)
    expect(canTransitionTask('submitted', 'cancelled')).toBe(false)
    expect(canTransitionTask('submitted', 'open')).toBe(false)
  })

  it('keeps settled tasks final', () => {
    for (const from of ['done', 'failed', 'cancelled'] as const) {
      for (const to of ['open', 'submitted', 'done', 'failed', 'cancelled'] as const) expect(canTransitionTask(from, to)).toBe(false)
    }
    expect(isOpenTask('submitted')).toBe(true)
    expect(isOpenTask('done')).toBe(false)
  })
})

describe('cron rules', () => {
  it('misses only open tasks past their deadline', () => {
    expect(isMissed({ status: 'open', due_at: '2026-10-09T11:59:00Z' }, NOW)).toBe(true)
    expect(isMissed({ status: 'open', due_at: '2026-10-09T12:01:00Z' }, NOW)).toBe(false)
    expect(isMissed({ status: 'submitted', due_at: '2026-10-09T11:00:00Z' }, NOW)).toBe(false)
    expect(isMissed({ status: 'open', due_at: null }, NOW)).toBe(false)
  })

  it('reminds once, within the last hour', () => {
    expect(taskReminderDue({ status: 'open', due_at: '2026-10-09T12:30:00Z', reminded_at: null }, NOW)).toBe(true)
    expect(taskReminderDue({ status: 'open', due_at: '2026-10-09T14:00:00Z', reminded_at: null }, NOW)).toBe(false)
    expect(taskReminderDue({ status: 'open', due_at: '2026-10-09T12:30:00Z', reminded_at: '2026-10-09T11:40:00Z' }, NOW)).toBe(false)
    expect(taskReminderDue({ status: 'open', due_at: '2026-10-09T11:30:00Z', reminded_at: null }, NOW)).toBe(false)
  })

  it('approves a submitted task after 24 hours of silence', () => {
    expect(autoApproveDue({ status: 'submitted', submitted_at: '2026-10-08T12:00:00Z' }, NOW)).toBe(true)
    expect(autoApproveDue({ status: 'submitted', submitted_at: '2026-10-08T12:01:00Z' }, NOW)).toBe(false)
    expect(autoApproveDue({ status: 'open', submitted_at: null }, NOW)).toBe(false)
  })

  it('gives no reward on a self-lock', () => {
    expect(effectiveReward(120, true)).toBe(0)
    expect(effectiveReward(120, false)).toBe(120)
  })
})

describe('shiftedUntil', () => {
  const until = NOW + 10 * 3_600_000

  it('adds a penalty and takes a reward off', () => {
    expect(shiftedUntil(until, 60, NOW)).toBe(until + 3_600_000)
    expect(shiftedUntil(until, -60, NOW)).toBe(until - 3_600_000)
  })

  it('never takes the lock closer than a minute from now', () => {
    expect(shiftedUntil(NOW + 30 * 60_000, -120, NOW)).toBe(NOW + 60_000)
  })

  it('does nothing when a reward cannot bite', () => {
    expect(shiftedUntil(NOW + 30_000, -60, NOW)).toBeNull()
  })
})

describe('wording and paths', () => {
  it('writes the chat lines', () => {
    expect(newTaskMessage('Cold shower', null)).toBe('📝 New task: Cold shower')
    expect(doneMessage('Cold shower', -120)).toBe('✅ Task done: Cold shower, -2h')
    expect(doneMessage('Cold shower', 0)).toBe('✅ Task done: Cold shower')
    expect(failedMessage('Cold shower', 360, true)).toBe('❌ Task missed: Cold shower, +6h')
    expect(failedMessage('Cold shower', 0, false)).toBe('❌ Task failed: Cold shower')
  })

  it('keeps proof photos in a tasks folder of the lock', () => {
    expect(taskPhotoPath('loq1', 't1')).toBe('loq1/tasks/t1.jpg')
  })
})

describe('deadline shortcuts', () => {
  it('offers tonight only with an hour to spare', () => {
    expect(tonight(new Date(2026, 9, 9, 18, 0))?.getHours()).toBe(22)
    expect(tonight(new Date(2026, 9, 9, 21, 30))).toBeNull()
  })

  it('works out tomorrow evening and the other choices', () => {
    const now = new Date(2026, 9, 9, 18, 0)
    const t = tomorrowEvening(now)
    expect([t.getDate(), t.getHours()]).toEqual([10, 22])
    expect(deadlineFor('none', '', now)).toBeNull()
    expect(deadlineFor('1h', '', now)).toBe(new Date(now.getTime() + 3_600_000).toISOString())
    expect(deadlineFor('custom', '', now)).toBeNull()
  })
})

describe('history', () => {
  const loq: LockHistoryRow = {
    id: 'loq_1', loqee_id: 'w', loqholder_id: 'k', status: 'active', created_at: '2026-10-01T00:00:00Z',
    accepted_at: null, loqed_until: '2026-10-20T00:00:00Z', ended_at: null, paused_at: null, combination_revealed_at: null,
  }

  it('shows done, failed and missed tasks', () => {
    const events = buildHistory(loq, [
      { action: 'loq_task_done', actor_id: 'k', created_at: '2026-10-02T10:00:00Z', details: { loq_id: 'loq_1' } },
      { action: 'loq_task_failed', actor_id: 'k', created_at: '2026-10-03T10:00:00Z', details: { loq_id: 'loq_1' } },
      { action: 'loq_task_failed', actor_id: 'k', created_at: '2026-10-04T10:00:00Z', details: { loq_id: 'loq_1', missed: true } },
    ], []).filter(e => e.type === 'task')
    expect(events.map(e => [e.task, e.actor])).toEqual([['done', 'keyholder'], ['failed', 'keyholder'], ['missed', 'system']])
  })
})
