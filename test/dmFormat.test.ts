import { describe, expect, it } from 'vitest'
import { dayLabel, listTime, timeLeft } from '~/utils/dmFormat'

const now = new Date('2026-10-05T12:00:00')

describe('listTime', () => {
  it('uses minutes, hours, yesterday, weekday and date', () => {
    expect(listTime(new Date('2026-10-05T11:59:40').toISOString(), now)).toBe('now')
    expect(listTime(new Date('2026-10-05T11:42:00').toISOString(), now)).toBe('18m')
    expect(listTime(new Date('2026-10-05T09:00:00').toISOString(), now)).toBe('3h')
    expect(listTime(new Date('2026-10-04T22:00:00').toISOString(), now)).toBe('Yesterday')
    expect(listTime(new Date('2026-10-02T10:00:00').toISOString(), now)).toBe('Fri')
    expect(listTime(new Date('2026-09-20T10:00:00').toISOString(), now)).toBe('20 Sept')
    expect(listTime(null, now)).toBe('')
  })
})

describe('dayLabel', () => {
  it('names today and yesterday', () => {
    expect(dayLabel(new Date('2026-10-05T08:00:00').toISOString(), now)).toBe('Today')
    expect(dayLabel(new Date('2026-10-04T08:00:00').toISOString(), now)).toBe('Yesterday')
  })
})

describe('timeLeft', () => {
  const t = now.getTime()
  it('picks minutes, hours or days', () => {
    expect(timeLeft(new Date(t + 40 * 60_000).toISOString(), t)).toBe('40m left')
    expect(timeLeft(new Date(t + 30 * 3_600_000).toISOString(), t)).toBe('30h left')
    expect(timeLeft(new Date(t + 9.5 * 86_400_000).toISOString(), t)).toBe('9d left')
    expect(timeLeft(new Date(t - 1000).toISOString(), t)).toBe('time is up')
    expect(timeLeft(null, t)).toBe('')
  })
})
