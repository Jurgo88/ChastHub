// Time labels used on the Messages screen. English UI, 24h clock.

export function listTime(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = now.getTime() - d.getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'now'
  if (min < 60) return `${min}m`
  if (d.toDateString() === now.toDateString()) return `${Math.floor(min / 60)}h`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  if (diff < 6 * 86_400_000) return d.toLocaleDateString('en-GB', { weekday: 'short' })
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === now.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// "9d left", "5h left", "40m left". Empty when there is no end date.
export function timeLeft(until: string | null | undefined, now = Date.now()): string {
  if (!until) return ''
  const ms = new Date(until).getTime() - now
  if (ms <= 0) return 'time is up'
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${Math.max(1, min)}m left`
  const h = Math.floor(min / 60)
  if (h < 48) return `${h}h left`
  return `${Math.floor(h / 24)}d left`
}
