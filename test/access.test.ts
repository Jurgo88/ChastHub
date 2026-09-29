import { describe, expect, it } from 'vitest'
import { hasPremiumAccess, isTrialActive, trialDaysLeft } from '~/utils/access'

const NOW = Date.parse('2026-10-10T12:00:00Z')
const inDays = (d: number) => new Date(NOW + d * 86_400_000).toISOString()

describe('premium access (free trial, migration 079)', () => {
  it('grants access to a paid subscriber without a trial', () => {
    expect(hasPremiumAccess({ subscription_status: 'active', trial_ends_at: null }, NOW)).toBe(true)
  })

  it('grants access while the trial is running', () => {
    const p = { subscription_status: 'inactive', trial_ends_at: inDays(5) }
    expect(isTrialActive(p, NOW)).toBe(true)
    expect(hasPremiumAccess(p, NOW)).toBe(true)
  })

  it('denies access once the trial has ended', () => {
    const p = { subscription_status: 'inactive', trial_ends_at: inDays(-1) }
    expect(isTrialActive(p, NOW)).toBe(false)
    expect(hasPremiumAccess(p, NOW)).toBe(false)
  })

  it('denies access with no profile or no trial', () => {
    expect(hasPremiumAccess(null, NOW)).toBe(false)
    expect(hasPremiumAccess({ subscription_status: 'inactive', trial_ends_at: null }, NOW)).toBe(false)
  })

  it('rounds the days left up', () => {
    expect(trialDaysLeft({ trial_ends_at: inDays(29.2) }, NOW)).toBe(30)
    expect(trialDaysLeft({ trial_ends_at: inDays(0.1) }, NOW)).toBe(1)
    expect(trialDaysLeft({ trial_ends_at: inDays(-3) }, NOW)).toBe(0)
  })
})
