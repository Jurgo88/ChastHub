import { describe, it, expect, vi, beforeEach } from 'vitest'

// TASK-164 — the client side: what is read from the landing URL and the
// referrer, and what goes onto the Google return URL.

let mod: typeof import('~/composables/useSignupSource')

beforeEach(async () => {
  // The capture is module state; each test gets a fresh module.
  vi.resetModules()
  mod = await import('~/composables/useSignupSource')
})

describe('readSignupSource', () => {
  it('reads the UTM tags and the referring host', () => {
    expect(mod.readSignupSource('?utm_source=ig&utm_campaign=launch', 'https://l.instagram.com/?u=x', 'chasthub.com'))
      .toEqual({ referrer: 'l.instagram.com', utm_source: 'ig', utm_medium: null, utm_campaign: 'launch' })
  })

  it('ignores a referrer from our own site', () => {
    expect(mod.readSignupSource('', 'https://chasthub.com/faq', 'chasthub.com').referrer).toBeNull()
  })

  it('prefers the referrer carried through the Google round trip', () => {
    // Back from Google, document.referrer is Google's sign-in page.
    expect(mod.readSignupSource('?signup_ref=reddit.com', 'https://accounts.google.com/', 'chasthub.com').referrer)
      .toBe('reddit.com')
  })
})

describe('useSignupSource', () => {
  it('has nothing to send, and leaves the Google return URL alone, when nothing was captured', () => {
    mod.captureSignupSource({ referrer: null, utm_source: null, utm_medium: null, utm_campaign: null })
    const s = mod.useSignupSource()

    expect(s.get()).toBeNull()
    expect(s.oauthReturnQuery()).toBe('')
  })

  it('carries what was captured onto the Google return URL', () => {
    mod.captureSignupSource({ referrer: 'instagram.com', utm_source: 'ig', utm_medium: null, utm_campaign: 'launch' })

    expect(mod.useSignupSource().oauthReturnQuery()).toBe('?signup_ref=instagram.com&utm_source=ig&utm_campaign=launch')
  })

  it('keeps the first capture — navigating inside the app does not overwrite it', () => {
    mod.captureSignupSource({ referrer: 'instagram.com', utm_source: null, utm_medium: null, utm_campaign: null })
    mod.captureSignupSource({ referrer: 'other.com', utm_source: null, utm_medium: null, utm_campaign: null })

    expect(mod.useSignupSource().get()?.referrer).toBe('instagram.com')
  })

  it('round-trips: what goes onto the return URL is read back the same on the callback page', () => {
    mod.captureSignupSource({ referrer: 'reddit.com', utm_source: 'r/x', utm_medium: 'social', utm_campaign: 'fall & winter' })
    const query = mod.useSignupSource().oauthReturnQuery()

    expect(mod.readSignupSource(query, 'https://accounts.google.com/', 'chasthub.com'))
      .toEqual({ referrer: 'reddit.com', utm_source: 'r/x', utm_medium: 'social', utm_campaign: 'fall & winter' })
  })
})
