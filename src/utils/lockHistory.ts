// Display side of the lock history: how a timeline event reads in the UI.
// Shared by the lock card and the archive page.

export interface HistoryEventView {
  type: string
  at: string
  actor: 'keyholder' | 'wearer' | 'visitor' | 'system'
  delta_minutes?: number
  count?: number
  mood?: string
  label?: string
}

export interface LockSummaryView {
  outcome: 'running' | 'completed' | 'ended_early' | 'cancelled'
  total_hours: number
  keyholder_added_hours: number
  keyholder_removed_hours: number
  visitor_added_hours: number
  visitor_removed_hours: number
  visitors: number
  pauses: number
  longest_stretch_hours: number
}

const MOOD_EMOJI: Record<string, string> = { calm: '😌', teased: '😏', struggling: '😣', desperate: '🥵', proud: '😇' }

/** "6h", "1h 30m", "45m", "2d 4h". */
export function spanMinutes(minutes: number): string {
  const m = Math.round(Math.abs(minutes))
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  const rest = m % 60
  if (d) return h ? `${d}d ${h}h` : `${d}d`
  if (h) return rest ? `${h}h ${rest}m` : `${h}h`
  return `${rest}m`
}

/** "11d 19h" for a number of hours. */
export function spanHours(hours: number): string {
  return spanMinutes(hours * 60)
}

export function describeEvent(e: HistoryEventView): { icon: string; text: string } {
  const by = e.actor === 'keyholder' ? 'Keyholder' : e.actor === 'wearer' ? 'Wearer' : 'System'
  const amount = spanMinutes(e.delta_minutes ?? 0)
  const n = e.count ?? 1

  switch (e.type) {
    case 'created': return { icon: '🔒', text: 'Locked' }
    case 'accepted': return { icon: '🤝', text: 'Keyholder took over the lock' }
    case 'time_added': return { icon: '⏫', text: `${by} added ${amount}` }
    case 'time_removed': return { icon: '⏬', text: `${by} took off ${amount}` }
    case 'paused': return { icon: '⏸️', text: `${by === 'System' ? 'Lock' : by} paused the lock` }
    case 'resumed': return { icon: '▶️', text: `${by === 'System' ? 'Lock' : by} resumed the lock` }
    case 'visitors_added': return { icon: '👀', text: n > 1 ? `${n} visitors added ${amount}` : `A visitor added ${amount}` }
    case 'visitors_removed': return { icon: '🕊️', text: n > 1 ? `${n} visitors took off ${amount}` : `A visitor took off ${amount}` }
    case 'checkin': return { icon: MOOD_EMOJI[e.mood ?? ''] ?? '📝', text: `Check-in: ${e.mood ?? ''}` }
    case 'wheel': return { icon: '🎡', text: `Spun the wheel: ${e.label ?? 'result'}` }
    case 'revealed': return { icon: '🔑', text: 'Combination revealed' }
    case 'ended': return { icon: '🔓', text: 'Lock ended' }
    case 'cancelled': return { icon: '✖️', text: 'Lock cancelled' }
    default: return { icon: '•', text: e.type }
  }
}

/** "Oct 3, 14:05" for a timestamp, in the viewer's zone. */
export function whenLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const OUTCOME_LABEL: Record<LockSummaryView['outcome'], string> = {
  running: 'Running',
  completed: 'Completed',
  ended_early: 'Ended early',
  cancelled: 'Cancelled',
}
