// TASK-164 — where this visitor came from, for the signup to record.
//
// Captured once, when the app starts (plugins/signupSource.client.ts), and
// kept in a module variable — deliberately NOT in a cookie, localStorage or
// sessionStorage. It lives as long as this page load does, which covers a
// visitor who lands and signs up in one go. A Google signup leaves the page,
// so the signup page hands the source to the OAuth return URL instead (see
// oauthReturnQuery), and the capture on the way back picks it up again.
//
// The server sanitises all of it (server/utils/signupSource.ts); this side
// only collects.

export interface SignupSource {
  referrer: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
}

// Carries the referrer across the Google round trip, where document.referrer
// becomes Google's own sign-in page.
const REFERRER_PARAM = 'signup_ref'
const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign'] as const

let captured: SignupSource | null = null

function externalReferrerHost(referrer: string, ownHost: string): string | null {
  if (!referrer) return null
  try {
    const url = new URL(referrer)
    return url.host === ownHost ? null : url.hostname
  }
  catch {
    return null
  }
}

// Pure, so it can be tested without a browser.
export function readSignupSource(search: string, referrer: string, ownHost: string): SignupSource {
  const params = new URLSearchParams(search)
  return {
    referrer: params.get(REFERRER_PARAM) || externalReferrerHost(referrer, ownHost),
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
  }
}

// First capture wins: later navigations inside the app must not overwrite
// what the visitor arrived with.
export function captureSignupSource(
  source: SignupSource = readSignupSource(window.location.search, document.referrer, window.location.host),
) {
  if (captured) return
  captured = source
}

export function useSignupSource() {
  function get(): SignupSource | null {
    if (!captured) return null
    return Object.values(captured).some(Boolean) ? captured : null
  }

  // Query string for the OAuth return URL, or '' when there is nothing to
  // carry — so an ordinary Google signup's return URL stays exactly as before.
  function oauthReturnQuery(): string {
    const source = get()
    if (!source) return ''
    const params = new URLSearchParams()
    if (source.referrer) params.set(REFERRER_PARAM, source.referrer)
    for (const key of UTM_PARAMS) {
      const value = source[key]
      if (value) params.set(key, value)
    }
    return `?${params}`
  }

  return { get, oauthReturnQuery }
}
