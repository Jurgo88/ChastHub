// TASK-140 — Google Analytics 4, gated on the cookie banner's answer.
//
// This is the second listener for the `cookie:accepted` / `cookie:declined`
// events CookieBanner.vue fires — the same pair plugins/clarity.client.ts
// uses (TASK-121) — rather than a second consent mechanism.
//
// Unlike Clarity, gtag.js is not loaded at all until consent is given: the
// banner promises "Decline and none are set", and GA's own Consent Mode
// still sends cookieless pings to Google when analytics_storage is denied.
// Not loading the tag is the only way to make that sentence true.
const CONSENT_KEY = 'cookie_consent'

export default defineNuxtPlugin(() => {
  const { public: { gaMeasurementId } } = useRuntimeConfig()

  // Preview builds can run without an ID rather than mixing their traffic
  // into the production property.
  if (!gaMeasurementId) return

  const router = useRouter()

  if (readStorage(CONSENT_KEY) === 'accepted') {
    start(gaMeasurementId, router)
  }
  else {
    // `once`: the banner is answered a single time per browser, and a second
    // accept would otherwise inject a second copy of the tag.
    window.addEventListener('cookie:accepted', () => start(gaMeasurementId, router), { once: true })
  }
})

function start(measurementId: string, router: ReturnType<typeof useRouter>) {
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments)
  }

  window.gtag('js', new Date())

  // Nothing in the product does ad targeting, so the ad buckets stay denied
  // even for a visitor who accepted — there is no reason to ask for storage
  // we have no use for. Mirrors the `ad_Storage: 'denied'` in the Clarity
  // plugin.
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'granted',
  })

  // `send_page_view: false` because the automatic one fires on `config`, and
  // after hydration every further navigation is client-side — GA would see
  // one hit per visit and nothing else. Page views are sent by hand below,
  // including the first.
  window.gtag('config', measurementId, { send_page_view: false })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
  document.head.appendChild(script)

  // Queued on the stub above, so ordering against the script load is safe.
  sendPageView()

  router.afterEach(() => {
    // The title is written by useHead during the DOM update that follows the
    // route change, so reading it synchronously here would attribute the new
    // path to the previous page's title.
    nextTick(sendPageView)
  })
}

function sendPageView() {
  window.gtag('event', 'page_view', {
    page_location: window.location.href,
    page_title: document.title,
  })
}

// Same guard as the Clarity plugin — localStorage throws rather than
// returning null in some in-app browsers, and a storage error should not be
// read as consent.
function readStorage(key: string): string | null {
  try { return localStorage.getItem(key) }
  catch { return null }
}

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
  }
}
