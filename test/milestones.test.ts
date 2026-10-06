import { describe, expect, it } from 'vitest'
import { isMilestoneKey, reachedMilestones } from '~/server/utils/milestones'

describe('reachedMilestones', () => {
  it('reaches the fixed ones by elapsed time', () => {
    expect(reachedMilestones(23, 1000)).toEqual([])
    expect(reachedMilestones(24, 1000)).toEqual(['24h'])
    expect(reachedMilestones(170, 1000)).toEqual(['24h', '3d', '7d'])
    expect(reachedMilestones(720, 2000)).toEqual(['24h', '3d', '7d', 'half', '14d', '30d'].filter(k => k !== 'half'))
  })

  it('reaches halfway only on locks of at least two days', () => {
    expect(reachedMilestones(10, 20)).toEqual([])
    expect(reachedMilestones(24, 48)).toEqual(['24h', 'half'])
    expect(reachedMilestones(40, 80)).toEqual(['24h', 'half'])
  })

  it('reaches the last day only on locks of at least three days, and not after the end', () => {
    expect(reachedMilestones(40, 60)).toEqual(['24h', 'half'])
    expect(reachedMilestones(48, 72)).toEqual(['24h', 'half', 'last_day'])
    expect(reachedMilestones(72, 72)).toEqual(['24h', '3d', 'half'])
  })
})

describe('isMilestoneKey', () => {
  it('accepts only known keys', () => {
    expect(isMilestoneKey('7d')).toBe(true)
    expect(isMilestoneKey('1y')).toBe(false)
    expect(isMilestoneKey(undefined)).toBe(false)
  })
})
