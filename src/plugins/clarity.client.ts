import Clarity from '@microsoft/clarity'

// TASK-121 — Microsoft Clarity, gated on the cookie banner's answer.
//
// The banner (CookieBanner.vue) already writes `cookie_consent` and fires
// `cookie:accepted` / `cookie:declined`; this plugin is the listener its
// "GA activation hook" comment was written for. GA4 now listens to the same
// two events in plugins/ga.client.ts, and anything added later should too
// rather than growing a second consent mechanism.
const CONSENT_KEY = 'cookie_consent'

export default defineNuxtPlugin(() => {
  const { public: { clarityProjectId } } = useRuntimeConfig()

  // Dev and preview builds run without an ID rather than polluting the
  // production project with local sessions.
  if (!clarityProjectId) return

  Clarity.init(clarityProjectId)

  // Order matters: `init` is what defines `window.clarity` (as a stub that
  // queues calls until the tag loads), so a consent call before it throws.
  sendConsent(readStorage(CONSENT_KEY) === 'accepted')

  window.addEventListener('cookie:accepted', () => sendConsent(true))
  window.addEventListener('cookie:declined', () => sendConsent(false))
})

function sendConsent(granted: boolean) {
  Clarity.consentV2({
    // Always denied: nothing in the product does ad targeting, so there is
    // no reason to ask Clarity to store ad data.
    ad_Storage: 'denied',
    analytics_Storage: granted ? 'granted' : 'denied',
  })
}

// Same guard as InstallBanner.vue — localStorage throws rather than returning
// null in some in-app browsers, and a storage error should not cost us the
// consent signal.
function readStorage(key: string): string | null {
  try { return localStorage.getItem(key) }
  catch { return null }
}
