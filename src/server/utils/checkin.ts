// Daily check-in rules, kept free of Nitro/Supabase so they can be unit tested.

export const MOODS = ['calm', 'teased', 'struggling', 'desperate', 'proud'] as const
export type Mood = typeof MOODS[number]

export const MOOD_EMOJI: Record<Mood, string> = {
  calm: '😌', teased: '😏', struggling: '😣', desperate: '🥵', proud: '😇',
}

export const MAX_NOTE_LENGTH = 140
export const MAX_CHECKIN_PENALTY_MINUTES = 4320
/** Local hour from which the evening reminder may go out. */
export const REMINDER_HOUR = 20

export function isMood(value: unknown): value is Mood {
  return typeof value === 'string' && (MOODS as readonly string[]).includes(value)
}

/** True for a time zone name Intl understands (e.g. "Europe/Bratislava"). */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  }
  catch {
    return false
  }
}

/** Calendar day (YYYY-MM-DD) and hour of `at` on the wall clock of `tz`. */
export function localParts(at: Date | number, tz: string): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(at)
  const get = (t: string) => parts.find(p => p.type === t)!.value
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) }
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Consecutive days with a check-in, counted back from today. Today is allowed
 * to still be open (the streak is alive until the day is over), and days the
 * lock spent paused are skipped instead of breaking the streak.
 */
export function computeStreak(dates: Iterable<string>, today: string, pausedDays: ReadonlySet<string> = new Set()): number {
  const have = new Set(dates)
  let day = have.has(today) ? today : shiftDate(today, -1)
  let streak = 0
  // Bounded so a bad input can never loop for long.
  for (let i = 0; i < 4000; i++) {
    if (have.has(day)) streak++
    else if (!pausedDays.has(day)) break
    day = shiftDate(day, -1)
  }
  return streak
}

/** Chat line the keyholder sees for a check-in. */
export function checkinMessage(mood: Mood, note: string | null): string {
  const text = `${MOOD_EMOJI[mood]} Check-in: ${mood}`
  return note ? `${text}. ${note}` : text
}

/**
 * Whether the evening reminder is due: it is past the reminder hour for the
 * wearer, no check-in yet today, and today's reminder has not gone out.
 */
export function reminderDue(localHour: number, today: string, checkedIn: boolean, remindedOn: string | null): boolean {
  return localHour >= REMINDER_HOUR && !checkedIn && remindedOn !== today
}

/**
 * The one day a missed check-in can be penalised right now: yesterday, once
 * the lock had existed that whole day and it has not already been settled.
 * Returns null when there is nothing to settle.
 */
export function dayToSettle(today: string, lockCreatedLocalDate: string, settledThrough: string | null): string | null {
  const yesterday = shiftDate(today, -1)
  if (lockCreatedLocalDate > yesterday) return null
  if (settledThrough && settledThrough >= yesterday) return null
  return yesterday
}

/**
 * Local days on which the lock was paused at any point, from its pause/resume
 * events (oldest first) and, if it is paused right now, `pausedAt`.
 */
export function pausedDays(
  events: { type: string; at: string }[],
  stillPausedSince: string | null,
  tz: string,
  now = Date.now(),
): Set<string> {
  const days = new Set<string>()
  const addRange = (fromMs: number, toMs: number) => {
    const last = localParts(toMs, tz).date
    let day = localParts(fromMs, tz).date
    for (let i = 0; i < 4000 && day <= last; i++) {
      days.add(day)
      day = shiftDate(day, 1)
    }
  }
  let since: number | null = null
  for (const e of events) {
    const t = new Date(e.at).getTime()
    if (e.type === 'paused' && since === null) since = t
    else if (e.type === 'resumed' && since !== null) { addRange(since, t); since = null }
  }
  if (since === null && stillPausedSince) since = new Date(stillPausedSince).getTime()
  if (since !== null) addRange(since, now)
  return days
}
