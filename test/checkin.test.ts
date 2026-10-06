import { describe, expect, it } from 'vitest'
import {
  checkinMessage, computeStreak, dayToSettle, isMood, isValidTimeZone, localParts, pausedDays, reminderDue, shiftDate,
} from '~/server/utils/checkin'

describe('input checks', () => {
  it('accepts only the five moods', () => {
    expect(isMood('teased')).toBe(true)
    expect(isMood('happy')).toBe(false)
    expect(isMood(undefined)).toBe(false)
  })

  it('accepts real time zones only', () => {
    expect(isValidTimeZone('Europe/Bratislava')).toBe(true)
    expect(isValidTimeZone('Mars/Olympus')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
    expect(isValidTimeZone(42)).toBe(false)
  })
})

describe('localParts', () => {
  it('reads the day in the wearer zone, not UTC', () => {
    const at = new Date('2026-10-05T23:30:00Z')
    expect(localParts(at, 'UTC')).toEqual({ date: '2026-10-05', hour: 23 })
    expect(localParts(at, 'Europe/Bratislava')).toEqual({ date: '2026-10-06', hour: 1 })
    expect(localParts(at, 'America/Los_Angeles')).toEqual({ date: '2026-10-05', hour: 16 })
  })

  it('reports midnight as hour 0', () => {
    expect(localParts(new Date('2026-10-05T22:00:00Z'), 'Europe/Bratislava')).toEqual({ date: '2026-10-06', hour: 0 })
  })
})

describe('computeStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(computeStreak(['2026-10-05', '2026-10-04', '2026-10-03'], '2026-10-05')).toBe(3)
  })

  it('keeps the streak alive while today is still open', () => {
    expect(computeStreak(['2026-10-04', '2026-10-03'], '2026-10-05')).toBe(2)
  })

  it('breaks on a missed day', () => {
    expect(computeStreak(['2026-10-05', '2026-10-03'], '2026-10-05')).toBe(1)
    expect(computeStreak(['2026-10-03'], '2026-10-05')).toBe(0)
  })

  it('skips days the lock was paused instead of breaking', () => {
    const paused = new Set(['2026-10-04', '2026-10-03'])
    expect(computeStreak(['2026-10-05', '2026-10-02', '2026-10-01'], '2026-10-05', paused)).toBe(3)
  })

  it('handles month and year boundaries', () => {
    expect(computeStreak(['2027-01-01', '2026-12-31', '2026-12-30'], '2027-01-01')).toBe(3)
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('pausedDays', () => {
  it('covers every local day between a pause and its resume', () => {
    const days = pausedDays([
      { type: 'paused', at: '2026-10-03T10:00:00Z' },
      { type: 'resumed', at: '2026-10-05T08:00:00Z' },
    ], null, 'UTC')
    expect([...days].sort()).toEqual(['2026-10-03', '2026-10-04', '2026-10-05'])
  })

  it('treats a lock still paused as paused until now', () => {
    const now = new Date('2026-10-06T12:00:00Z').getTime()
    const days = pausedDays([], '2026-10-05T10:00:00Z', 'UTC', now)
    expect([...days].sort()).toEqual(['2026-10-05', '2026-10-06'])
  })

  it('is empty when the lock was never paused', () => {
    expect(pausedDays([], null, 'UTC').size).toBe(0)
  })
})

describe('reminderDue', () => {
  it('fires from 20:00, once, and only without a check-in', () => {
    expect(reminderDue(19, '2026-10-05', false, null)).toBe(false)
    expect(reminderDue(20, '2026-10-05', false, null)).toBe(true)
    expect(reminderDue(22, '2026-10-05', false, '2026-10-04')).toBe(true)
    expect(reminderDue(22, '2026-10-05', false, '2026-10-05')).toBe(false)
    expect(reminderDue(21, '2026-10-05', true, null)).toBe(false)
  })
})

describe('dayToSettle', () => {
  it('settles yesterday once', () => {
    expect(dayToSettle('2026-10-05', '2026-10-01', null)).toBe('2026-10-04')
    expect(dayToSettle('2026-10-05', '2026-10-01', '2026-10-03')).toBe('2026-10-04')
    expect(dayToSettle('2026-10-05', '2026-10-01', '2026-10-04')).toBeNull()
  })

  it('does not penalise a day the lock did not exist for', () => {
    expect(dayToSettle('2026-10-05', '2026-10-05', null)).toBeNull()
    expect(dayToSettle('2026-10-05', '2026-10-04', null)).toBe('2026-10-04')
  })
})

describe('checkinMessage', () => {
  it('reads well with and without a note', () => {
    expect(checkinMessage('teased', null)).toBe('😏 Check-in: teased')
    expect(checkinMessage('proud', 'Day 6, going strong')).toBe('😇 Check-in: proud. Day 6, going strong')
  })
})
