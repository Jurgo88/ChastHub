import { describe, it, expect } from 'vitest'
import { sanitizeSignupSource, signupSourceColumns } from '~/server/utils/signupSource'

// TASK-164 — the client reports where a signup came from; the server keeps
// only a host and three short campaign tags, and never lets it fail a signup.

describe('sanitizeSignupSource', () => {
  it('keeps the host of a full referrer URL, never its path or query', () => {
    expect(sanitizeSignupSource({ referrer: 'https://www.Instagram.com/p/abc?igsh=secret' }).referrer)
      .toBe('instagram.com')
  })

  it('accepts a bare host, as carried through the Google round trip', () => {
    expect(sanitizeSignupSource({ referrer: 'l.facebook.com' }).referrer).toBe('l.facebook.com')
  })

  it.each([
    'https://chasthub.com/discover',
    'https://deploy-preview-12--chasthub.netlify.app/',
    'https://abcd.supabase.co/auth/v1/callback',
    'https://accounts.google.com/o/oauth2',
    'https://checkout.stripe.com/c/pay',
    'http://localhost:3000/',
  ])('does not count our own sites or auth/payment hops as a source: %s', (referrer) => {
    expect(sanitizeSignupSource({ referrer }).referrer).toBeNull()
  })

  it('does not count the host the request came in on', () => {
    expect(sanitizeSignupSource({ referrer: 'https://staging.example.org/' }, 'staging.example.org').referrer)
      .toBeNull()
  })

  it.each(['javascript:alert(1)', 'not a url at all', '', 42, null])(
    'drops a referrer that is not a host: %s',
    (referrer) => {
      expect(sanitizeSignupSource({ referrer }).referrer).toBeNull()
    },
  )

  it('trims UTM values, strips control characters and caps the length', () => {
    const s = sanitizeSignupSource({
      utm_source: '  ig\u0000\n ',
      utm_medium: 'x'.repeat(500),
      utm_campaign: 'launch',
    })
    expect(s.utm_source).toBe('ig')
    expect(s.utm_medium).toHaveLength(100)
    expect(s.utm_campaign).toBe('launch')
  })

  it.each([undefined, null, 'string', 42, []])('turns anything malformed into all-null: %s', (raw) => {
    expect(sanitizeSignupSource(raw)).toEqual({ referrer: null, utm_source: null, utm_medium: null, utm_campaign: null })
  })

  it('maps onto the four profile columns', () => {
    expect(signupSourceColumns(sanitizeSignupSource({ referrer: 'reddit.com', utm_source: 'r' }))).toEqual({
      signup_referrer: 'reddit.com',
      signup_utm_source: 'r',
      signup_utm_medium: null,
      signup_utm_campaign: null,
    })
  })
})
