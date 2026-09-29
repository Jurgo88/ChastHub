// TASK-184 — building UTM-tagged links for the admin link builder.
//
// Links opened inside apps (Instagram, TikTok, Telegram…) usually arrive with
// no referrer, but the UTM tags in the URL survive, and signup records them
// (TASK-164). Values are normalised so one source always reads the same in
// "How they found us": "X", " x " and "X " must not become three rows.

export const LANDING_PAGES = [
  { path: '/', label: 'Home' },
  { path: '/auth/signup', label: 'Sign up' },
  { path: '/install', label: 'Install the app' },
  { path: '/faq', label: 'FAQ' },
] as const

export const SOURCE_PRESETS = ['x', 'reddit', 'instagram', 'tiktok', 'telegram', 'discord', 'fetlife', 'email', 'newsletter'] as const
export const MEDIUM_PRESETS = ['social', 'bio', 'post', 'dm', 'email', 'ad', 'qr', 'partner'] as const

/** "Autumn Launch!" → "autumn-launch": lowercase, spaces to "-", only a-z 0-9 - _ . */
export function normaliseUtm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // "č" → "c"
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_.]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100) // the signup side keeps at most 100 characters
}

export interface TrackedLinkInput {
  path: string
  source: string
  medium: string
  campaign: string
  content?: string
}

/** Null until source, medium and campaign are all non-empty after normalising. */
export function buildTrackedUrl(siteUrl: string, input: TrackedLinkInput): string | null {
  const source = normaliseUtm(input.source)
  const medium = normaliseUtm(input.medium)
  const campaign = normaliseUtm(input.campaign)
  const content = normaliseUtm(input.content ?? '')
  if (!source || !medium || !campaign) return null

  const url = new URL(input.path, siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`)
  url.searchParams.set('utm_source', source)
  url.searchParams.set('utm_medium', medium)
  url.searchParams.set('utm_campaign', campaign)
  if (content) url.searchParams.set('utm_content', content)
  return url.toString()
}
