import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

// TASK-137 — which geo headers actually reach a Nitro function on this host
// could not be verified from a dev machine, so the parsing side is pinned
// here instead: the shape Netlify documents, the fallbacks, and every way a
// header can be malformed. The one thing this must never do is throw — a
// signup cannot fail because the edge sent something unexpected.

const headers = new Map<string, string>()

const g = globalThis as Record<string, unknown>
g.getRequestHeader = (_event: unknown, name: string) => headers.get(name.toLowerCase())

const { readSignupOrigin } = await import('~/server/utils/signupOrigin')

const EVENT = {} as never

function setHeaders(h: Record<string, string>) {
  headers.clear()
  for (const [k, v] of Object.entries(h)) headers.set(k.toLowerCase(), v)
}

function netlifyGeo(payload: unknown) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
}

const FULL_GEO = {
  city: 'Bratislava',
  country: { code: 'SK', name: 'Slovakia' },
  subdivision: { code: 'BL', name: 'Bratislavský kraj' },
  timezone: 'Europe/Bratislava',
  latitude: 48.15,
  longitude: 17.11,
}

describe('readSignupOrigin', () => {
  beforeEach(() => {
    headers.clear()
    // spyOn returns the same mock on re-spy, so the counts carry over between
    // tests unless they are cleared.
    vi.spyOn(console, 'warn').mockImplementation(() => {}).mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => {}).mockClear()
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  it('reads country, region and timezone out of the Netlify payload', () => {
    setHeaders({ 'x-nf-geo': netlifyGeo(FULL_GEO) })

    expect(readSignupOrigin(EVENT)).toMatchObject({
      country: 'SK',
      region: 'BL',
      timezone: 'Europe/Bratislava',
    })
  })

  it('stores nothing that pins a person to a place', () => {
    setHeaders({ 'x-nf-geo': netlifyGeo(FULL_GEO) })

    // City and coordinates are in the payload and are deliberately dropped.
    const origin = readSignupOrigin(EVENT) as unknown as Record<string, unknown>
    expect(Object.keys(origin).sort()).toEqual(['country', 'locale', 'region', 'timezone'])
    expect(JSON.stringify(origin)).not.toMatch(/Bratislava,|48\.15|17\.11/)
  })

  it('falls back to x-country, then cf-ipcountry', () => {
    setHeaders({ 'x-country': 'de' })
    expect(readSignupOrigin(EVENT).country).toBe('DE')

    setHeaders({ 'cf-ipcountry': 'fr' })
    expect(readSignupOrigin(EVENT).country).toBe('FR')
  })

  it('prefers the Netlify payload over the bare country headers', () => {
    setHeaders({ 'x-nf-geo': netlifyGeo(FULL_GEO), 'x-country': 'DE' })
    expect(readSignupOrigin(EVENT).country).toBe('SK')
  })

  it('takes the first language out of Accept-Language', () => {
    setHeaders({ 'accept-language': 'sk-SK,sk;q=0.9,en;q=0.8' })
    expect(readSignupOrigin(EVENT).locale).toBe('sk-SK')
  })

  it("prefers Google's own locale over the browser's", () => {
    setHeaders({ 'accept-language': 'en-US,en;q=0.9' })
    expect(readSignupOrigin(EVENT, 'sk').locale).toBe('sk')
  })

  it('ignores a wildcard Accept-Language', () => {
    setHeaders({ 'accept-language': '*' })
    expect(readSignupOrigin(EVENT).locale).toBeNull()
  })

  it('records nothing at all when the host sends no geo headers', () => {
    setHeaders({})

    expect(readSignupOrigin(EVENT)).toEqual({
      country: null,
      region: null,
      timezone: null,
      locale: null,
    })
  })

  it('warns once when no country could be determined', () => {
    setHeaders({})
    readSignupOrigin(EVENT)
    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['not base64 at all', '!!!not-base64!!!'],
    ['base64 of something that is not JSON', Buffer.from('nope').toString('base64')],
    ['an empty string', ''],
  ])('treats %s as absent rather than throwing', (_label, value) => {
    setHeaders({ 'x-nf-geo': value, 'x-country': 'IT' })

    // Malformed payload must not take the fallback down with it.
    expect(() => readSignupOrigin(EVENT)).not.toThrow()
    expect(readSignupOrigin(EVENT).country).toBe('IT')
  })

  it.each([
    ['a country name instead of a code', 'Slovakia'],
    ['a three-letter code', 'SVK'],
    ['an empty code', ''],
  ])('rejects %s, which the column constraint would refuse', (_label, code) => {
    setHeaders({ 'x-nf-geo': netlifyGeo({ country: { code } }) })
    expect(readSignupOrigin(EVENT).country).toBeNull()
  })

  it('survives a payload whose fields are the wrong shape', () => {
    setHeaders({ 'x-nf-geo': netlifyGeo({ country: 'SK', subdivision: 42, timezone: null }) })

    expect(() => readSignupOrigin(EVENT)).not.toThrow()
    expect(readSignupOrigin(EVENT).country).toBeNull()
  })
})
