// Time presets for the create-lock flow. Pure functions of "now" so the
// flow can recompute right before it submits: "until Monday 8:00" has to
// end on Monday 8:00 even if the wearer took ten minutes on the next step.

export const MAX_LOCK_DAYS = 3650 // keep in sync with server/utils/loqValidation.ts
export const MAX_LOCK_MINUTES = MAX_LOCK_DAYS * 1440
export const LOCKTOBER_30_MINUTES = 30 * 1440

export type TimeChoice =
  | { kind: 'minutes'; minutes: number }
  | { kind: 'until'; at: Date }

export interface TimePreset {
  id: string
  label: string
  choice: (now: Date) => TimeChoice
}

const fixed = (minutes: number) => () => ({ kind: 'minutes', minutes }) as TimeChoice

/** Monday 08:00 local, at least 12 hours ahead (so a Monday morning click means next week). */
export function nextMondayMorning(now: Date): Date {
  const d = new Date(now)
  d.setHours(8, 0, 0, 0)
  const add = (8 - d.getDay()) % 7 // days until Monday, 0 if today
  d.setDate(d.getDate() + add)
  if (d.getTime() - now.getTime() < 12 * 3600_000) d.setDate(d.getDate() + 7)
  return d
}

/** Nov 1, 00:00 local of the current year. */
export function novemberFirst(now: Date): Date {
  return new Date(now.getFullYear(), 10, 1, 0, 0, 0, 0)
}

export function isOctober(now: Date): boolean {
  return now.getMonth() === 9
}

export function presetsFor(now: Date): TimePreset[] {
  const list: TimePreset[] = [
    { id: '4h', label: '4 hours', choice: fixed(240) },
    { id: '12h', label: '12 hours', choice: fixed(720) },
    { id: '1d', label: '1 day', choice: fixed(1440) },
    { id: '3d', label: '3 days', choice: fixed(3 * 1440) },
    { id: '1w', label: '1 week', choice: fixed(7 * 1440) },
    { id: '2w', label: '2 weeks', choice: fixed(14 * 1440) },
    { id: '30d', label: '30 days', choice: fixed(30 * 1440) },
    { id: 'weekend', label: 'Till Monday', choice: n => ({ kind: 'until', at: nextMondayMorning(n) }) },
  ]
  if (isOctober(now)) {
    list.push({ id: 'nov1', label: 'Till Nov 1', choice: n => ({ kind: 'until', at: novemberFirst(n) }) })
  }
  return list
}

/** Whole minutes the lock should run, or 0 when the choice is not usable. */
export function choiceMinutes(choice: TimeChoice | null, now: Date): number {
  if (!choice) return 0
  const m = choice.kind === 'minutes'
    ? Math.round(choice.minutes)
    : Math.ceil((choice.at.getTime() - now.getTime()) / 60_000)
  return m >= 1 && m <= MAX_LOCK_MINUTES ? m : 0
}

/** "3d 4h", "12h", "45m". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const d = Math.floor(minutes / 1440)
  const h = Math.floor((minutes % 1440) / 60)
  const m = minutes % 60
  if (d) return h ? `${d}d ${h}h` : `${d}d`
  return m ? `${h}h ${m}m` : `${h}h`
}

/** Random padlock code, digits only. */
export function randomCode(digits = 4, rand: () => number = Math.random): string {
  let s = ''
  for (let i = 0; i < digits; i++) s += Math.floor(rand() * 10)
  return s
}
