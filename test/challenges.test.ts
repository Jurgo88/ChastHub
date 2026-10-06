import { describe, expect, it } from 'vitest'
import {
  challengePhase, entryEnd, evaluateEntry, joinDeadline, joinProblem, rankEntries,
  type ChallengeEntryState, type ChallengeLock, type ChallengeRules,
} from '~/utils/challenges'

const t = (iso: string) => new Date(iso).getTime()

const fixed: ChallengeRules = {
  active: true, starts_at: '2026-11-01T00:00:00Z', ends_at: '2026-12-01T00:00:00Z', duration_minutes: null, max_pause_minutes: 1440,
}
const sevenDays: ChallengeRules = {
  active: true, starts_at: null, ends_at: null, duration_minutes: 10080, max_pause_minutes: 1440,
}

const lock = (o: Partial<ChallengeLock> = {}): ChallengeLock => ({
  status: 'active', created_at: '2026-10-20T00:00:00Z', loqed_until: '2026-12-15T00:00:00Z', ended_at: null, paused_at: null, ...o,
})
const entry = (o: Partial<ChallengeEntryState> = {}): ChallengeEntryState => ({
  joined_at: '2026-11-01T10:00:00Z', completed_at: null, failed_at: null, ...o,
})

describe('challengePhase and joinDeadline', () => {
  it('tells where a fixed challenge is', () => {
    expect(challengePhase(fixed, t('2026-10-20T00:00:00Z'))).toBe('upcoming')
    expect(challengePhase(fixed, t('2026-11-15T00:00:00Z'))).toBe('running')
    expect(challengePhase(fixed, t('2026-12-02T00:00:00Z'))).toBe('finished')
    expect(challengePhase({ ...fixed, active: false }, t('2026-11-15T00:00:00Z'))).toBe('closed')
  })

  it('a length-from-joining challenge is always running', () => {
    expect(challengePhase(sevenDays, t('2030-01-01T00:00:00Z'))).toBe('running')
    expect(joinDeadline(sevenDays)).toBeNull()
  })

  it('a fixed challenge can be joined during its first day', () => {
    expect(joinDeadline(fixed)).toBe(t('2026-11-02T00:00:00Z'))
  })
})

describe('joinProblem', () => {
  it('lets a running lock that covers the challenge join, before or on day one', () => {
    expect(joinProblem(fixed, lock(), t('2026-10-25T00:00:00Z'))).toBeNull()
    expect(joinProblem(fixed, lock(), t('2026-11-01T12:00:00Z'))).toBeNull()
    expect(joinProblem(sevenDays, lock({ loqed_until: '2026-11-20T00:00:00Z' }), t('2026-11-05T00:00:00Z'))).toBeNull()
  })

  it('refuses after the first day, for a closed challenge and for a missing lock', () => {
    expect(joinProblem(fixed, lock(), t('2026-11-05T00:00:00Z'))).toMatch(/closed/i)
    expect(joinProblem({ ...fixed, active: false }, lock(), t('2026-10-25T00:00:00Z'))).toMatch(/closed/i)
    expect(joinProblem(fixed, null, t('2026-10-25T00:00:00Z'))).toMatch(/running lock/i)
    expect(joinProblem(fixed, lock({ status: 'ended' }), t('2026-10-25T00:00:00Z'))).toMatch(/running lock/i)
  })

  it('refuses a lock that ends before the challenge', () => {
    expect(joinProblem(fixed, lock({ loqed_until: '2026-11-20T00:00:00Z' }), t('2026-10-25T00:00:00Z'))).toMatch(/ends before/i)
    expect(joinProblem(sevenDays, lock({ loqed_until: '2026-11-03T00:00:00Z' }), t('2026-11-01T00:00:00Z'))).toMatch(/ends before/i)
  })

  it('refuses a lock that started after day one of a fixed challenge', () => {
    expect(joinProblem(fixed, lock({ created_at: '2026-11-01T20:00:00Z' }), t('2026-11-01T21:00:00Z'))).toBeNull()
    expect(joinProblem({ ...fixed, starts_at: '2026-11-01T00:00:00Z' }, lock({ created_at: '2026-11-03T00:00:00Z' }), t('2026-11-01T21:00:00Z'))).toMatch(/too late/i)
  })
})

describe('entryEnd', () => {
  it('is the shared end, or the join time plus the length', () => {
    expect(entryEnd(fixed, entry())).toBe(t('2026-12-01T00:00:00Z'))
    expect(entryEnd(sevenDays, entry({ joined_at: '2026-11-01T10:00:00Z' }))).toBe(t('2026-11-08T10:00:00Z'))
  })
})

describe('evaluateEntry', () => {
  it('stays active while the lock runs and the end is ahead', () => {
    expect(evaluateEntry(fixed, entry(), lock(), t('2026-11-15T00:00:00Z'))).toEqual({ status: 'active', at: null })
  })

  it('completes at the end of the challenge', () => {
    expect(evaluateEntry(fixed, entry(), lock(), t('2026-12-01T00:05:00Z'))).toEqual({ status: 'completed', at: t('2026-12-01T00:00:00Z') })
    expect(evaluateEntry(sevenDays, entry(), lock(), t('2026-11-09T00:00:00Z'))).toEqual({ status: 'completed', at: t('2026-11-08T10:00:00Z') })
  })

  it('fails when the lock ends early, completes when it ends at or after the finish', () => {
    expect(evaluateEntry(fixed, entry(), lock({ status: 'ended', ended_at: '2026-11-10T00:00:00Z' }), t('2026-11-11T00:00:00Z')))
      .toEqual({ status: 'failed', at: t('2026-11-10T00:00:00Z') })
    expect(evaluateEntry(fixed, entry(), lock({ status: 'ended', ended_at: '2026-12-01T06:00:00Z' }), t('2026-12-02T00:00:00Z')))
      .toEqual({ status: 'completed', at: t('2026-12-01T00:00:00Z') })
  })

  it('fails a lock that is gone', () => {
    expect(evaluateEntry(fixed, entry(), null, t('2026-11-15T00:00:00Z')).status).toBe('failed')
  })

  it('tolerates a short pause and fails a long one at the moment the allowance ran out', () => {
    const paused = lock({ status: 'paused', paused_at: '2026-11-10T00:00:00Z' })
    expect(evaluateEntry(fixed, entry(), paused, t('2026-11-10T23:00:00Z')).status).toBe('active')
    expect(evaluateEntry(fixed, entry(), paused, t('2026-11-11T01:00:00Z'))).toEqual({ status: 'failed', at: t('2026-11-11T00:00:00Z') })
  })

  it('keeps a stored result', () => {
    expect(evaluateEntry(fixed, entry({ completed_at: '2026-12-01T00:00:00Z' }), null, t('2027-01-01T00:00:00Z')).status).toBe('completed')
    expect(evaluateEntry(fixed, entry({ failed_at: '2026-11-02T00:00:00Z' }), lock(), t('2026-11-03T00:00:00Z')).status).toBe('failed')
  })
})

describe('rankEntries', () => {
  it('puts finishers first, then those still going by hours, and drops failed ones', () => {
    const rows = [
      { id: 'a', status: 'active' as const, hours: 100 },
      { id: 'b', status: 'failed' as const, hours: 900 },
      { id: 'c', status: 'completed' as const, hours: 50 },
      { id: 'd', status: 'active' as const, hours: 300 },
    ]
    expect(rankEntries(rows).map(r => r.id)).toEqual(['c', 'd', 'a'])
  })
})
