import { describe, it, expect } from 'vitest'
import { DELETION_REASONS, deletionFollowUp } from '~/utils/deletionReasons'

// TASK-176 — which deletion reasons get an extra step, and which step.

describe('deletionFollowUp', () => {
  it('offers a bug report for "too many bugs"', () => {
    expect(deletionFollowUp('technical_issues', '')).toEqual({ step: 'report', kind: 'bug' })
  })

  it('offers a security report for privacy concerns', () => {
    expect(deletionFollowUp('privacy', 'anything')).toEqual({ step: 'report', kind: 'security' })
  })

  it.each(['other', 'missing_features'])('asks "what was it?" for %s only when nothing was written', (reason) => {
    expect(deletionFollowUp(reason, '')).toEqual({ step: 'note' })
    expect(deletionFollowUp(reason, '   ')).toEqual({ step: 'note' })
    expect(deletionFollowUp(reason, 'No dark mode')).toBeNull()
  })

  it.each(['too_expensive', 'not_using', 'taking_break'])('adds no step for %s — nothing to fix', (reason) => {
    expect(deletionFollowUp(reason, '')).toBeNull()
  })

  it('adds no step for a bad experience with someone — reporting a person is TASK-174', () => {
    expect(deletionFollowUp('bad_experience', '')).toBeNull()
  })

  it('has a decision for every reason the dialog offers', () => {
    // Guards against a new reason silently getting no follow-up by accident:
    // update this list deliberately when adding one.
    const withStep = DELETION_REASONS.map(r => r.value).filter(v => deletionFollowUp(v, '') !== null)
    expect(withStep.sort()).toEqual(['missing_features', 'other', 'privacy', 'technical_issues'])
  })
})
