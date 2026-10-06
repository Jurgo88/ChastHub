import { describe, expect, it } from 'vitest'
import { applySurprise, parseClock, planSurprises, surpriseText, zonedToUtc, type SurpriseSettings } from '~/server/utils/surprises'
import { localParts } from '~/server/utils/checkin'

function seeded(seed = 7) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
}

const base: SurpriseSettings = {
  per_week: 4, min_minutes: 60, max_minutes: 360, allow_remove: false,
  window_start: '08:00', window_end: '22:00', tz: 'Europe/Bratislava', message: null,
}
const FROM = new Date('2026-10-05T10:00:00Z').getTime()

describe('parseClock', () => {
  it('reads HH:MM and HH:MM:SS', () => {
    expect(parseClock('08:30')).toBe(510)
    expect(parseClock('22:00:00')).toBe(1320)
    expect(parseClock('24:00')).toBeNull()
    expect(parseClock('8:30')).toBeNull()
    expect(parseClock(5)).toBeNull()
  })
})

describe('zonedToUtc', () => {
  it('turns a wall-clock time into the right instant, summer and winter', () => {
    expect(new Date(zonedToUtc('2026-07-01', 600, 'Europe/Bratislava')).toISOString()).toBe('2026-07-01T08:00:00.000Z')
    expect(new Date(zonedToUtc('2026-01-01', 600, 'Europe/Bratislava')).toISOString()).toBe('2026-01-01T09:00:00.000Z')
    expect(new Date(zonedToUtc('2026-10-05', 0, 'UTC')).toISOString()).toBe('2026-10-05T00:00:00.000Z')
  })
})

describe('planSurprises', () => {
  it('plans per_week moments inside the window of the wearer zone', () => {
    const plan = planSurprises(base, FROM, seeded())
    expect(plan.length).toBeGreaterThan(0)
    expect(plan.length).toBeLessThanOrEqual(4)
    for (const p of plan) {
      const t = new Date(p.due_at).getTime()
      expect(t).toBeGreaterThan(FROM)
      const { hour } = localParts(t, base.tz)
      expect(hour).toBeGreaterThanOrEqual(8)
      expect(hour).toBeLessThan(22)
      expect(p.delta_minutes).toBeGreaterThanOrEqual(60)
      expect(p.delta_minutes).toBeLessThanOrEqual(360)
      expect(p.delta_minutes % 5).toBe(0)
    }
    expect([...plan].sort((a, b) => a.due_at.localeCompare(b.due_at))).toEqual(plan)
  })

  it('puts up to seven a week on different days', () => {
    const plan = planSurprises({ ...base, per_week: 7 }, FROM, seeded(3))
    const days = plan.map(p => localParts(new Date(p.due_at).getTime(), base.tz).date)
    expect(new Set(days).size).toBe(days.length)
  })

  it('only removes time when allowed', () => {
    expect(planSurprises({ ...base, per_week: 14 }, FROM, seeded(5)).every(p => p.delta_minutes > 0)).toBe(true)
    const withRemove = planSurprises({ ...base, per_week: 14, allow_remove: true }, FROM, seeded(5))
    expect(withRemove.some(p => p.delta_minutes < 0)).toBe(true)
  })

  it('plans nothing for a broken window', () => {
    expect(planSurprises({ ...base, window_start: '22:00', window_end: '08:00' }, FROM)).toEqual([])
    expect(planSurprises({ ...base, window_start: 'x' }, FROM)).toEqual([])
  })
})

describe('surpriseText', () => {
  it('uses the default or the custom text', () => {
    expect(surpriseText(180, null)).toBe('Your keyholder had a little surprise for you: +3h')
    expect(surpriseText(-90, null)).toContain('-1h 30m')
    expect(surpriseText(30, ' Surprise! ')).toBe('Surprise! (+30m)')
  })
})

describe('applySurprise', () => {
  const now = new Date('2026-10-05T10:00:00Z').getTime()
  it('adds and removes time', () => {
    expect(applySurprise('2026-10-06T10:00:00Z', 60, now, 100000)).toBe('2026-10-06T11:00:00.000Z')
    expect(applySurprise('2026-10-06T10:00:00Z', -60, now, 100000)).toBe('2026-10-06T09:00:00.000Z')
  })
  it('refuses to cut below a minute left', () => {
    expect(applySurprise('2026-10-05T10:30:00Z', -60, now, 100000)).toBeNull()
  })
  it('caps at the maximum total', () => {
    expect(applySurprise('2026-10-05T11:00:00Z', 600, now, 120)).toBe('2026-10-05T12:00:00.000Z')
  })
})
