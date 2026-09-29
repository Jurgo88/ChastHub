import type { H3Event } from 'h3'

// TASK-137 — where a user signed up from, taken from what the edge already
// knows rather than asking them.
//
// Deliberately coarse. Netlify's geo payload also carries city, latitude and
// longitude; none of that is stored. On a chastity/keyholding platform, a
// row saying which city a named account signed up from is a liability with
// no matching use — country and region answer "where are our users" just as
// well, and the timezone is the part that is actually useful operationally.
//
// The IP itself is not stored either. It is already in `rate_limit_buckets`
// briefly for rate limiting; keeping a permanent copy on the profile would be
// a different thing entirely.

export interface SignupOrigin {
  country: string | null
  region: string | null
  timezone: string | null
  locale: string | null
}

const EMPTY: SignupOrigin = { country: null, region: null, timezone: null, locale: null }

interface NetlifyGeo {
  city?: string
  country?: { code?: string, name?: string }
  subdivision?: { code?: string, name?: string }
  timezone?: string
}

// Netlify sends `x-nf-geo` as base64-encoded JSON. Anything malformed is
// treated as absent: a geo header is a nice-to-have and must never be able to
// fail a signup.
function parseNetlifyGeo(raw: string | undefined): NetlifyGeo | null {
  if (!raw) return null
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as NetlifyGeo
  }
  catch {
    return null
  }
}

// "sk-SK,sk;q=0.9,en;q=0.8" → "sk-SK"
function firstLanguage(header: string | undefined): string | null {
  if (!header) return null
  const first = header.split(',')[0]?.split(';')[0]?.trim()
  if (!first || first === '*') return null
  return first.slice(0, 35)
}

function normaliseCountry(value: string | null | undefined): string | null {
  if (!value) return null
  const code = value.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) ? code : null
}

/**
 * Reads the request's origin from edge-provided headers.
 *
 * `googleLocale` comes from `auth.users.raw_user_meta_data.locale`, which the
 * Google identity supplies and which we otherwise discard — it is a better
 * signal than Accept-Language when it exists, because it is the account's own
 * setting rather than whatever browser happens to be open.
 *
 * Every field is independently nullable. A signup from a host that sends no
 * geo headers simply records nothing, and that is a normal outcome, not an
 * error.
 */
export function readSignupOrigin(event: H3Event, googleLocale?: string | null): SignupOrigin {
  try {
    const geo = parseNetlifyGeo(getRequestHeader(event, 'x-nf-geo'))

    const country = normaliseCountry(geo?.country?.code)
      // Fallbacks for hosts that send a bare country header rather than the
      // Netlify payload. Harmless where they are absent.
      ?? normaliseCountry(getRequestHeader(event, 'x-country'))
      ?? normaliseCountry(getRequestHeader(event, 'cf-ipcountry'))

    const origin: SignupOrigin = {
      country,
      region: geo?.subdivision?.code?.trim().slice(0, 10) || null,
      timezone: geo?.timezone?.trim().slice(0, 60) || null,
      locale: firstLanguage(googleLocale ?? undefined)
        ?? firstLanguage(getRequestHeader(event, 'accept-language')),
    }

    // Which geo headers actually arrive depends on the host and the plan, and
    // that could not be verified from here. One line in the logs on the first
    // real signup settles it without a debug deploy.
    if (!origin.country) {
      console.warn('[signupOrigin] no country header on this request — x-nf-geo absent or unparseable')
    }

    return origin
  }
  catch (err) {
    console.error('[signupOrigin] failed to read origin, continuing without it:', err)
    return EMPTY
  }
}
