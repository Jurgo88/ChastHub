// Shared formatting helpers for loq cards (loqee + loqholder dashboards).
// All named exports are auto-imported by Nuxt.

// TASK-070: loqs.emotion now stores the emoji itself (custom, free-form) —
// this table only exists so pre-migration-045 rows/cached data using the
// old preset keys still render correctly. Anything not in this map is
// assumed to already be a raw emoji and passes through unchanged.
export const LOQ_EMOTIONS: Record<string, string> = {
  excited: '🤭',
  chill: '😅',
  weak: '😵',
  nervous: '🥺',
  hopeless: '😭',
}

export function emotionEmoji(value: string): string {
  return LOQ_EMOTIONS[value] ?? value
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
