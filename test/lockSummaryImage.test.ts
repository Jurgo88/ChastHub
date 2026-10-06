import { describe, expect, it } from 'vitest'
import { lockSummarySvg } from '~/server/utils/lockSummaryImage'
import type { LockSummary } from '~/server/utils/loqHistory'

const base: LockSummary = {
  outcome: 'completed',
  total_hours: 283,
  keyholder_added_hours: 6,
  keyholder_removed_hours: 0,
  visitor_added_hours: 3,
  visitor_removed_hours: 0,
  visitors: 4,
  pauses: 1,
  longest_stretch_hours: 120,
}

describe('lockSummarySvg', () => {
  it('shows the total, the outcome and the numbers', () => {
    const svg = lockSummarySvg(base)
    expect(svg).toContain('LOCK COMPLETED')
    expect(svg).toContain('>11d 19h<')
    expect(svg).toContain('+9h')
    expect(svg).toContain('4')
    expect(svg).toContain('VISITORS')
    expect(svg).toContain('PAUSE<')
    expect(svg).toContain('>5d<')
  })

  it('leaves out tiles with nothing in them', () => {
    const svg = lockSummarySvg({ ...base, keyholder_added_hours: 0, visitor_added_hours: 0, visitors: 0 })
    expect(svg).not.toContain('TIME ADDED')
    expect(svg).not.toContain('VISITOR')
  })

  it('labels an early end', () => {
    expect(lockSummarySvg({ ...base, outcome: 'ended_early' })).toContain('LOCK ENDED EARLY')
  })
})
