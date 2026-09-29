import { describe, expect, it } from 'vitest'
import { containsLink, countdown, isValidSession, scheduleAt, windowsAround, zonedToUtc } from '~/utils/loungeSchedule'

const SESSIONS = [
  { name: 'Europe', tz: 'Europe/Berlin', start: '19:00', end: '23:00' },
  { name: 'Americas', tz: 'America/New_York', start: '20:00', end: '24:00' },
]
const at = (iso: string) => new Date(iso).getTime()

describe('zonedToUtc', () => {
  it('handles summer and winter time', () => {
    expect(new Date(zonedToUtc(2026, 10, 12, 19, 0, 'Europe/Berlin')).toISOString()).toBe('2026-10-12T17:00:00.000Z')
    expect(new Date(zonedToUtc(2026, 10, 26, 19, 0, 'Europe/Berlin')).toISOString()).toBe('2026-10-26T18:00:00.000Z')
    expect(new Date(zonedToUtc(2026, 10, 12, 24, 0, 'America/New_York')).toISOString()).toBe('2026-10-13T04:00:00.000Z')
  })
})

describe('scheduleAt', () => {
  it('finds the open session', () => {
    const s = scheduleAt(SESSIONS, '2026-10-01', '2026-10-31', at('2026-10-12T18:30:00Z'))
    expect(s.open?.name).toBe('Europe')
    expect(s.open?.day).toBe(12)
    expect(s.next?.name).toBe('Americas')
    expect(s.next?.start).toBe('2026-10-13T00:00:00.000Z')
  })

  it('is closed between sessions', () => {
    const s = scheduleAt(SESSIONS, '2026-10-01', '2026-10-31', at('2026-10-12T22:00:00Z'))
    expect(s.open).toBeNull()
    expect(s.previous?.name).toBe('Europe')
    expect(s.next?.name).toBe('Americas')
  })

  it('uses the local date of the Americas session', () => {
    const s = scheduleAt(SESSIONS, '2026-10-01', '2026-10-31', at('2026-10-13T02:00:00Z'))
    expect(s.open?.name).toBe('Americas')
    expect(s.open?.date).toBe('2026-10-12')
  })

  it('respects the date range', () => {
    const before = scheduleAt(SESSIONS, '2026-10-01', '2026-10-31', at('2026-09-20T18:00:00Z'))
    expect(before.open).toBeNull()
    expect(before.next?.date).toBe('2026-10-01')
    expect(before.next?.name).toBe('Europe')
    const last = scheduleAt(SESSIONS, '2026-10-01', '2026-10-31', at('2026-11-01T02:00:00Z'))
    expect(last.open?.date).toBe('2026-10-31')
    expect(last.next).toBeNull()
  })

  it('keeps sessions ordered', () => {
    const w = windowsAround(SESSIONS, '2026-10-01', '2026-10-31', at('2026-10-15T12:00:00Z'))
    expect(w.map(x => x.start)).toEqual([...w.map(x => x.start)].sort())
  })
})

describe('validation and helpers', () => {
  it('validates sessions', () => {
    expect(isValidSession({ name: 'X', tz: 'Europe/Berlin', start: '19:00', end: '23:00' })).toBe(true)
    expect(isValidSession({ name: 'X', tz: 'Mars/Base', start: '19:00', end: '23:00' })).toBe(false)
    expect(isValidSession({ name: 'X', tz: 'Europe/Berlin', start: '25:00', end: '23:00' })).toBe(false)
    expect(isValidSession({ name: '', tz: 'Europe/Berlin', start: '19:00', end: '23:00' })).toBe(false)
  })

  it('spots links', () => {
    expect(containsLink('see https://x.y')).toBe(true)
    expect(containsLink('go to onlyfans.com now')).toBe(true)
    expect(containsLink('www.example')).toBe(true)
    expect(containsLink('Day 5. Feeling good... really.')).toBe(false)
  })

  it('formats countdowns', () => {
    const now = at('2026-10-12T15:48:00Z')
    expect(countdown('2026-10-12T19:00:00Z', now)).toBe('3h 12m')
    expect(countdown('2026-10-12T16:00:00Z', now)).toBe('12m')
  })
})
