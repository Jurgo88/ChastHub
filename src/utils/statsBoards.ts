import type { StatsBoardKey, StatsPeriod } from '~/types'

// How each Stats board is labelled and how its number reads.

export interface BoardMeta {
  label: string
  /** 'hours' reads as a duration, 'count' as a plain number. */
  kind: 'hours' | 'count'
  /** Short word under the leader's value. */
  unit: string
  /** Boards about "right now" ignore the period switch. */
  periodless?: boolean
  /** Shown as "+38h" rather than "38h". */
  plus?: boolean
}

export const BOARD_META: Record<StatsBoardKey, BoardMeta> = {
  wearer_longest: { label: 'Longest lock', kind: 'hours', unit: 'longest lock' },
  wearer_total: { label: 'Total time', kind: 'hours', unit: 'locked in total' },
  wearer_completed: { label: 'Locks completed', kind: 'count', unit: 'locks completed' },
  wearer_running: { label: 'Locked right now', kind: 'hours', unit: 'and counting', periodless: true },
  keyholder_locks: { label: 'Most locks', kind: 'count', unit: 'locks held' },
  keyholder_hours: { label: 'Hours held', kind: 'hours', unit: 'in their hands' },
  keyholder_wearers: { label: 'Most wearers', kind: 'count', unit: 'different wearers' },
  keyholder_holding: { label: 'Holding now', kind: 'count', unit: 'locks right now', periodless: true },
  crowd: { label: 'Crowd favorites', kind: 'hours', unit: 'added by visitors', plus: true },
  locktober_survivors: { label: 'Survivors', kind: 'hours', unit: 'unbroken', periodless: true },
  locktober_30: { label: 'Locktober 30', kind: 'hours', unit: 'of 30 days', periodless: true },
}

/** Locktober 30 progress: "Day 12" until 30 days, then "Finished". */
export function locktober30Label(hours: number): string {
  return hours >= 720 ? 'Finished ✓' : `Day ${Math.floor(hours / 24) + 1}`
}

/** 5 → "5h", 283 → "11d 19h". */
export function formatStatsDuration(hours: number): string {
  const h = Math.max(0, Math.floor(hours))
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  const rest = h % 24
  return rest ? `${d}d ${rest}h` : `${d}d`
}

export function formatBoardValue(board: StatsBoardKey, value: number): string {
  if (board === 'locktober_30') return locktober30Label(value)
  const meta = BOARD_META[board]
  const text = meta.kind === 'hours' ? formatStatsDuration(value) : Math.round(value).toLocaleString('en-US')
  return meta.plus ? `+${text}` : text
}

export function periodLabel(period: StatsPeriod, locktoberYear: number): string {
  if (period === 'month') return 'This month'
  if (period === 'locktober') return `Locktober ${locktoberYear}`
  return 'All time'
}
