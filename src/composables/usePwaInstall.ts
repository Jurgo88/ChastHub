// TASK-105 — captures the `beforeinstallprompt` event (Chromium/Android/
// desktop) so the profile settings banner can trigger the native install
// flow. The event can fire before any component mounts, so state lives at
// module scope (shared across every usePwaInstall() call) rather than
// inside the composable function.
//
// TASK-106 — the native prompt only exists on Chromium, so platform and
// in-app-browser detection live here too: every other visitor gets manual
// instructions (/install) instead of nothing at all.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallPlatform = 'ios' | 'android' | 'desktop'

const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
const isInstallable = ref(false)
const isInstalled = ref(false)
let listenersAttached = false

function attachListeners() {
  if (listenersAttached || typeof window === 'undefined') return
  listenersAttached = true

  isInstalled.value = window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true)

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt.value = e as BeforeInstallPromptEvent
    isInstallable.value = true
  })

  window.addEventListener('appinstalled', () => {
    isInstalled.value = true
    isInstallable.value = false
    deferredPrompt.value = null
  })
}

function detectPlatform(): InstallPlatform {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent

  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  // iPadOS 13+ Safari requests desktop sites by default and reports a
  // "Macintosh" UA, so a touch-capable Mac is really an iPad.
  if (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'desktop'
}

// Links shared on social media open in the host app's webview, which has no
// "Add to Home Screen" / install entry at all — those users have to be told
// to reopen the link in a real browser first.
const IN_APP_BROWSERS: Array<[RegExp, string]> = [
  [/Instagram/i, 'Instagram'],
  [/FBAN|FBAV|FB_IAB/i, 'Facebook'],
  [/Messenger/i, 'Messenger'],
  [/WhatsApp/i, 'WhatsApp'],
  [/BytedanceWebview|musical_ly|TikTok/i, 'TikTok'],
  [/Snapchat/i, 'Snapchat'],
  [/LinkedInApp/i, 'LinkedIn'],
  [/Twitter/i, 'X'],
  [/Pinterest/i, 'Pinterest'],
  [/Telegram/i, 'Telegram'],
]

function detectInAppBrowser(): string | null {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent
  return IN_APP_BROWSERS.find(([re]) => re.test(ua))?.[1] ?? null
}

export function usePwaInstall() {
  attachListeners()

  const platform = computed<InstallPlatform>(() =>
    import.meta.client ? detectPlatform() : 'desktop',
  )
  const isIos = computed(() => platform.value === 'ios')

  // Name of the social app whose webview we're stuck in, or null.
  const inAppBrowser = computed(() => (import.meta.client ? detectInAppBrowser() : null))

  // Whether to offer installing at all. Deliberately not gated on
  // `isInstallable`: Chromium fires `beforeinstallprompt` at most once per
  // page load (and not at all in Firefox or Safari), so gating on it hid the
  // instructions from everyone but freshly-loaded Chromium tabs.
  const showPrompt = computed(() => !isInstalled.value)

  async function install(): Promise<boolean> {
    if (!deferredPrompt.value) return false
    await deferredPrompt.value.prompt()
    const { outcome } = await deferredPrompt.value.userChoice
    deferredPrompt.value = null
    isInstallable.value = false
    return outcome === 'accepted'
  }

  return { isInstallable, isInstalled, isIos, platform, inAppBrowser, showPrompt, install }
}
