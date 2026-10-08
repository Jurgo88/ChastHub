import { describe, expect, it } from 'vitest'
import {
  canTransition, CODE_ALPHABET, generateCode, isHHMM, isOpen, isPastDue, isValidCode, nextAutoTime, photoPath,
  randomTimeInWindow, requestMessage, zonedTimeToUtc,
} from '~/server/utils/verification'
import { fitWithin } from '~/utils/resizeImage'

describe('code', () => {
  it('is four characters without look-alikes', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode(max => Math.floor(Math.random() * max))
      expect(code).toHaveLength(4)
      expect(code).not.toMatch(/[01OI]/)
      expect(isValidCode(code)).toBe(true)
    }
    expect(CODE_ALPHABET).toHaveLength(32)
  })

  it('rejects malformed codes', () => {
    expect(isValidCode('AB0D')).toBe(false)
    expect(isValidCode('abcd')).toBe(false)
    expect(isValidCode('ABC')).toBe(false)
    expect(isValidCode(1234)).toBe(false)
  })

  it('builds the storage path inside the lock folder', () => {
    expect(photoPath('loq1', 'v1')).toBe('loq1/v1.jpg')
  })
})

describe('state transitions', () => {
  it('lets a pending request be submitted, expired or cancelled', () => {
    expect(canTransition('pending', 'submitted')).toBe(true)
    expect(canTransition('pending', 'expired')).toBe(true)
    expect(canTransition('pending', 'cancelled')).toBe(true)
    expect(canTransition('pending', 'approved')).toBe(false)
  })

  it('lets only a submitted photo be reviewed', () => {
    expect(canTransition('submitted', 'approved')).toBe(true)
    expect(canTransition('submitted', 'rejected')).toBe(true)
    expect(canTransition('submitted', 'expired')).toBe(false)
  })

  it('treats every settled state as final', () => {
    for (const s of ['approved', 'rejected', 'expired', 'cancelled'] as const) {
      for (const t of ['pending', 'submitted', 'approved', 'rejected', 'expired', 'cancelled'] as const) {
        expect(canTransition(s, t)).toBe(false)
      }
    }
  })

  it('counts pending and submitted as open', () => {
    expect(isOpen('pending')).toBe(true)
    expect(isOpen('submitted')).toBe(true)
    expect(isOpen('approved')).toBe(false)
  })

  it('knows when a request is past due', () => {
    const now = Date.parse('2026-10-08T12:00:00Z')
    expect(isPastDue('2026-10-08T11:59:00Z', now)).toBe(true)
    expect(isPastDue('2026-10-08T12:00:01Z', now)).toBe(false)
  })
})

describe('random daily time', () => {
  it('validates HH:MM', () => {
    expect(isHHMM('09:00')).toBe(true)
    expect(isHHMM('24:00')).toBe(false)
    expect(isHHMM('9:00')).toBe(false)
  })

  it('converts a wall clock to UTC, also across daylight saving', () => {
    // Bratislava is UTC+2 in summer and UTC+1 in winter.
    expect(new Date(zonedTimeToUtc('2026-07-01', 9 * 60, 'Europe/Bratislava')).toISOString()).toBe('2026-07-01T07:00:00.000Z')
    expect(new Date(zonedTimeToUtc('2026-12-01', 9 * 60, 'Europe/Bratislava')).toISOString()).toBe('2026-12-01T08:00:00.000Z')
    expect(new Date(zonedTimeToUtc('2026-10-25', 9 * 60, 'Europe/Bratislava')).toISOString()).toBe('2026-10-25T08:00:00.000Z')
  })

  it('stays inside the window', () => {
    const lo = zonedTimeToUtc('2026-10-08', 9 * 60, 'Europe/Bratislava')
    const hi = zonedTimeToUtc('2026-10-08', 21 * 60, 'Europe/Bratislava')
    expect(randomTimeInWindow('2026-10-08', '09:00', '21:00', 'Europe/Bratislava', () => 0)).toBe(lo)
    const nearEnd = randomTimeInWindow('2026-10-08', '09:00', '21:00', 'Europe/Bratislava', () => 0.999999)
    expect(nearEnd).toBeGreaterThanOrEqual(lo)
    expect(nearEnd).toBeLessThan(hi)
  })

  it('rolls today when the window is still ahead, tomorrow otherwise', () => {
    const tz = 'Europe/Bratislava'
    const morning = Date.parse('2026-10-08T05:00:00Z') // 07:00 local
    expect(new Date(nextAutoTime(morning, '09:00', '21:00', tz, () => 0)).toISOString()).toBe('2026-10-08T07:00:00.000Z')
    const night = Date.parse('2026-10-08T21:00:00Z') // 23:00 local
    expect(new Date(nextAutoTime(night, '09:00', '21:00', tz, () => 0)).toISOString()).toBe('2026-10-09T07:00:00.000Z')
  })

  it('never returns a time that has already passed', () => {
    const now = Date.parse('2026-10-08T10:00:00Z') // 12:00 local, inside the window
    for (let i = 0; i < 50; i++) {
      expect(nextAutoTime(now, '09:00', '21:00', 'Europe/Bratislava', Math.random)).toBeGreaterThan(now)
    }
  })
})

describe('wording', () => {
  it('puts the code and the time in the chat line', () => {
    expect(requestMessage('7K2Q', 120)).toContain('7K2Q')
    expect(requestMessage('7K2Q', 120)).toContain('2h')
    expect(requestMessage('7K2Q', 30)).toContain('30m')
  })
})

describe('photo size', () => {
  it('shrinks the long side to 1600 and keeps the ratio', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 })
  })

  it('never enlarges', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })
})
