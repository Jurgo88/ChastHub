import { describe, expect, it } from 'vitest'
import { formatLeft, lockOgSvg } from '~/server/utils/lockOgImage'

describe('formatLeft', () => {
  it('picks the two largest units', () => {
    expect(formatLeft((4 * 24 + 11) * 3_600_000 + 5 * 60_000)).toBe('4d 11h')
    expect(formatLeft(3 * 86_400_000)).toBe('3d')
    expect(formatLeft(11 * 3_600_000 + 20 * 60_000)).toBe('11h 20m')
    expect(formatLeft(37 * 60_000)).toBe('37m')
    expect(formatLeft(20_000)).toBe('<1m')
    expect(formatLeft(-5)).toBe('0m')
  })
})

describe('lockOgSvg', () => {
  const base = { state: 'locked' as const, leftMs: 3_600_000, progress: 0.5, visitors: 3, addedHours: 4, permission: 'both' as const }

  it('shows the state, time and stats', () => {
    const svg = lockOgSvg(base)
    expect(svg).toContain('LIVE LOCK')
    expect(svg).toContain('>1h<')
    expect(svg).toContain('3 visitors')
    expect(svg).toContain('+4h added')
    expect(svg).toContain('Add time or show mercy')
  })

  it('handles ended and paused locks', () => {
    expect(lockOgSvg({ ...base, state: 'ended' })).toContain('Unlocked')
    expect(lockOgSvg({ ...base, state: 'paused' })).toContain('PAUSED')
  })

  it('leaves out the stat line without visitors', () => {
    expect(lockOgSvg({ ...base, visitors: 0, addedHours: 0 })).not.toContain('visitor')
  })
})
