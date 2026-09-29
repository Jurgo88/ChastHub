import { describe, it, expect } from 'vitest'
import { buildTrackedUrl, normaliseUtm } from '~/utils/trackedLink'
import { sanitizeSignupSource } from '~/server/utils/signupSource'

// TASK-184 — the admin link builder's URLs, and that signup keeps what they carry.

const SITE = 'https://chasthub.com'

describe('normaliseUtm', () => {
  it.each([
    ['X', 'x'],
    ['  Autumn Launch!  ', 'autumn-launch'],
    ['Letná  kampaň', 'letna-kampan'],
    ['a--b__c..d', 'a-b__c..d'],
    ['-edge-', 'edge'],
    ['???', ''],
  ])('%s → %s', (input, out) => {
    expect(normaliseUtm(input)).toBe(out)
  })

  it('caps at 100 characters, like signup does', () => {
    expect(normaliseUtm('x'.repeat(150))).toHaveLength(100)
  })
})

describe('buildTrackedUrl', () => {
  it('builds the link from the issue example', () => {
    expect(buildTrackedUrl(SITE, { path: '/auth/signup', source: 'X', medium: 'Social', campaign: 'Autumn Launch' }))
      .toBe('https://chasthub.com/auth/signup?utm_source=x&utm_medium=social&utm_campaign=autumn-launch')
  })

  it('adds content only when given', () => {
    expect(buildTrackedUrl(SITE, { path: '/', source: 'reddit', medium: 'post', campaign: 'launch', content: 'Banner A' }))
      .toBe('https://chasthub.com/?utm_source=reddit&utm_medium=post&utm_campaign=launch&utm_content=banner-a')
  })

  it('works with or without a trailing slash on the site URL', () => {
    const input = { path: '/faq', source: 'x', medium: 'bio', campaign: 'c' }
    expect(buildTrackedUrl(`${SITE}/`, input)).toBe(buildTrackedUrl(SITE, input))
  })

  it.each([
    { source: '', medium: 'bio', campaign: 'c' },
    { source: 'x', medium: '  ', campaign: 'c' },
    { source: 'x', medium: 'bio', campaign: '!!!' },
  ])('gives no link until source, medium and campaign are all set', (partial) => {
    expect(buildTrackedUrl(SITE, { path: '/', ...partial })).toBeNull()
  })

  it('produces tags that signup keeps unchanged', () => {
    const url = new URL(buildTrackedUrl(SITE, { path: '/', source: 'Telegram', medium: 'DM', campaign: 'Friends & Fans' })!)
    const recorded = sanitizeSignupSource({
      utm_source: url.searchParams.get('utm_source'),
      utm_medium: url.searchParams.get('utm_medium'),
      utm_campaign: url.searchParams.get('utm_campaign'),
    })
    expect(recorded).toMatchObject({ utm_source: 'telegram', utm_medium: 'dm', utm_campaign: 'friends-fans' })
  })
})
