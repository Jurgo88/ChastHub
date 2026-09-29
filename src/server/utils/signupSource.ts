// TASK-164 — where a signup came from, as the client reported it.
//
// The client captures the referring page and utm_* parameters in memory
// (composables/useSignupSource.ts) and sends them with the signup. None of it
// is trustworthy — anyone can craft a link with utm_source=whatever — and it
// only ever feeds aggregate counts, so the job here is to keep it small and
// harmless, not to verify it:
//   * referrer: the host only, lowercased, "www." dropped. Never a path or a
//     query string, which can carry identifiers.
//   * hosts that are us or our auth/payment flow are not a source.
//   * UTM values: trimmed, control characters removed, capped at 100 chars.
// Anything malformed becomes null; a source must never be able to fail a
// signup.

export interface SignupSource {
  referrer: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
}

const EMPTY: SignupSource = { referrer: null, utm_source: null, utm_medium: null, utm_campaign: null }

// Our own sites and the hops a signup passes through on the way back to us.
const NOT_A_SOURCE = [
  /(^|\.)chasthub\.com$/,
  /(^|\.)netlify\.app$/,
  /(^|\.)supabase\.co$/,
  /^accounts\.google\.[a-z.]+$/,
  /(^|\.)stripe\.com$/,
  /^localhost$/,
]

const HOSTNAME = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/

function cleanReferrer(raw: unknown, ownHost?: string): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  let host: string
  try {
    // Accept a bare host ("instagram.com") as well as a full URL.
    host = new URL(raw.includes('://') ? raw : `https://${raw}`).hostname.toLowerCase()
  }
  catch {
    return null
  }
  host = host.replace(/^www\./, '')
  if (host.length > 253 || !HOSTNAME.test(host)) return null
  if (ownHost && host === ownHost.toLowerCase().replace(/^www\./, '').split(':')[0]) return null
  if (NOT_A_SOURCE.some(re => re.test(host))) return null
  return host
}

function cleanUtm(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  // eslint-disable-next-line no-control-regex
  const value = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 100)
  return value || null
}

export function sanitizeSignupSource(raw: unknown, ownHost?: string): SignupSource {
  if (!raw || typeof raw !== 'object') return { ...EMPTY }
  const r = raw as Record<string, unknown>
  return {
    referrer: cleanReferrer(r.referrer, ownHost),
    utm_source: cleanUtm(r.utm_source),
    utm_medium: cleanUtm(r.utm_medium),
    utm_campaign: cleanUtm(r.utm_campaign),
  }
}

/** The four profile columns, ready to spread into an insert. */
export function signupSourceColumns(source: SignupSource) {
  return {
    signup_referrer: source.referrer,
    signup_utm_source: source.utm_source,
    signup_utm_medium: source.utm_medium,
    signup_utm_campaign: source.utm_campaign,
  }
}
