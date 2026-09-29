export interface AvatarPreset {
  key: string
  color: string
  src: string
}

// Shown when a profile has no avatar_url set at all (neither an uploaded
// photo nor a picked preset) — e.g. a brand-new account.
export const DEFAULT_AVATAR_URL = '/images/default_avatar.png'

// TASK-151 — the presets are artwork now, not swatches. `color` stays because
// it is still doing work: it is the neon halo UserAvatar paints behind the
// image, and the fallback colour while the image is still loading.
//
// `key` is what the database stores, as `preset:<key>`. Two of the masters
// arrived named for the colour they look like rather than the key they map to
// (cyan → teal, purple → indigo); the keys are the ones that must not move,
// because renaming one orphans every avatar already chosen.
export const AVATAR_PRESETS: AvatarPreset[] = [
  { key: 'blue', color: '#0000ff', src: '/images/avatars/avatar-blue.webp' },
  { key: 'indigo', color: '#5b21ff', src: '/images/avatars/avatar-indigo.webp' },
  { key: 'pink', color: '#ff2d78', src: '/images/avatars/avatar-pink.webp' },
  { key: 'orange', color: '#ff8800', src: '/images/avatars/avatar-orange.webp' },
  { key: 'green', color: '#00c864', src: '/images/avatars/avatar-green.webp' },
  { key: 'teal', color: '#00c8c8', src: '/images/avatars/avatar-teal.webp' },
]

const PRESET_PREFIX = 'preset:'

export function presetAvatarUrl(key: string): string {
  return `${PRESET_PREFIX}${key}`
}

export function presetKeyFromAvatarUrl(avatarUrl: string): string | null {
  return avatarUrl.startsWith(PRESET_PREFIX) ? avatarUrl.slice(PRESET_PREFIX.length) : null
}

export function isValidPresetAvatarUrl(avatarUrl: string): boolean {
  const key = presetKeyFromAvatarUrl(avatarUrl)
  return key !== null && AVATAR_PRESETS.some(p => p.key === key)
}
