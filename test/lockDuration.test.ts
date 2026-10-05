import { describe, it, expect } from 'vitest'
import { nextMondayMorning, novemberFirst, presetsFor, choiceMinutes, formatMinutes, randomCode, MAX_LOCK_MINUTES } from '~/utils/lockDuration'

describe('lockDuration', () => {
  it('next Monday 8:00 from a Friday evening', () => {
    const d = nextMondayMorning(new Date(2026, 9, 2, 20, 0))
    expect(d.getDay()).toBe(1)
    expect(d.getDate()).toBe(5)
    expect(d.getHours()).toBe(8)
  })

  it('Monday morning means next week', () => {
    expect(nextMondayMorning(new Date(2026, 9, 5, 7, 0)).getDate()).toBe(12)
  })

  it('Sunday night still lands on the coming Monday', () => {
    expect(nextMondayMorning(new Date(2026, 9, 4, 18, 0)).getDate()).toBe(5)
  })

  it('Nov 1 preset only in October', () => {
    expect(presetsFor(new Date(2026, 9, 6)).some(p => p.id === 'nov1')).toBe(true)
    expect(presetsFor(new Date(2026, 10, 6)).some(p => p.id === 'nov1')).toBe(false)
  })

  it('minutes until a date, rounded up', () => {
    const now = new Date(2026, 9, 31, 23, 0, 30)
    expect(choiceMinutes({ kind: 'until', at: novemberFirst(now) }, now)).toBe(60)
  })

  it('rejects past dates and huge values', () => {
    const now = new Date(2026, 9, 6)
    expect(choiceMinutes({ kind: 'until', at: new Date(2026, 9, 5) }, now)).toBe(0)
    expect(choiceMinutes({ kind: 'minutes', minutes: MAX_LOCK_MINUTES + 1 }, now)).toBe(0)
    expect(choiceMinutes(null, now)).toBe(0)
  })

  it('formats', () => {
    expect(formatMinutes(45)).toBe('45m')
    expect(formatMinutes(90)).toBe('1h 30m')
    expect(formatMinutes(30 * 1440)).toBe('30d')
    expect(formatMinutes(1440 + 240)).toBe('1d 4h')
  })

  it('random code', () => {
    expect(randomCode(4, () => 0.55)).toBe('5555')
    expect(randomCode()).toMatch(/^\d{4}$/)
  })
})
