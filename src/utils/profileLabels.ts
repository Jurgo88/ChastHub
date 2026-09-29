import type { Gender } from '~/types'

// UI words for values the database stores in its own vocabulary.

export function roleLabel(role: string | null | undefined): string {
  if (role === 'loqee') return 'Wearer'
  if (role === 'loqholder') return 'Keyholder'
  if (role === 'admin') return 'Admin'
  return ''
}

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'man', label: 'Man' },
  { value: 'woman', label: 'Woman' },
  { value: 'trans', label: 'Trans' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'other', label: 'Other' },
]

export function genderLabel(gender: Gender | null | undefined): string {
  return GENDER_OPTIONS.find(g => g.value === gender)?.label ?? ''
}

/** 5 → "5h", 70 → "70h", 312 → "13d". Short enough for a stat tile. */
export function formatHours(hours: number): string {
  if (!hours || hours < 0) return '0h'
  if (hours < 72) return `${Math.round(hours)}h`
  return `${Math.round(hours / 24)}d`
}

export function memberSinceLabel(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
