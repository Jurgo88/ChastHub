import { describe, expect, it } from 'vitest'
import { formatBoardValue, formatDuration } from '~/utils/statsBoards'
import { lockHours } from '~/server/utils/profileStats'

describe('formatDuration', () => {
  it('reads hours under a day and days plus hours above', () => {
    expect(formatDuration(5.4)).toBe('5h')
    expect(formatDuration(24)).toBe('1d')
    expect(formatDuration(283)).toBe('11d 19h')
  })

  it('marks crowd values with a plus and counts as whole numbers', () => {
    expect(formatBoardValue('crowd', 38)).toBe('+1d 14h')
    expect(formatBoardValue('keyholder_locks', 1234)).toBe('1,234')
  })
})

describe('lockHours (same rule as stats_board)', () => {
  const now = Date.parse('2026-10-10T00:00:00Z')
  const base = { accepted_at: null, paused_at: null }

  it('counts an early-ended lock only until it ended', () => {
    expect(lockHours({ ...base, status: 'ended', created_at: '2026-10-01T00:00:00Z', loqed_until: '2026-10-09T00:00:00Z', ended_at: '2026-10-03T00:00:00Z' }, 'created', now)).toBe(48)
  })

  it('counts a running lock until now and a paused one until the pause', () => {
    expect(lockHours({ ...base, status: 'active', created_at: '2026-10-09T00:00:00Z', loqed_until: '2026-10-20T00:00:00Z', ended_at: null }, 'created', now)).toBe(24)
    expect(lockHours({ ...base, status: 'paused', paused_at: '2026-10-09T12:00:00Z', created_at: '2026-10-09T00:00:00Z', loqed_until: '2026-10-20T00:00:00Z', ended_at: null }, 'created', now)).toBe(12)
  })

  it('starts keyholder time at acceptance', () => {
    expect(lockHours({ ...base, status: 'ended', accepted_at: '2026-10-02T00:00:00Z', created_at: '2026-10-01T00:00:00Z', loqed_until: '2026-10-03T00:00:00Z', ended_at: '2026-10-03T00:00:00Z' }, 'accepted', now)).toBe(24)
  })
})
