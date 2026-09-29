// Lounge opening hours. Sessions are wall-clock windows in a named time zone
// ("19:00 to 23:00 in Europe/Berlin"), so daylight saving changes move them
// with local time instead of shifting everyone by an hour. Shared by the
// server (who may post, when to announce) and the client (countdowns).

export interface LoungeSessionDef {
  name: string
  tz: string
  start: string // "HH:MM"
  end: string // "HH:MM", "24:00" allowed; an end before the start rolls to the next day
}

export interface LoungeWindow {
  name: string
  start: string // ISO
  end: string // ISO
  /** Local calendar date of the session in its own time zone, "YYYY-MM-DD". */
  date: string
  /** Day of the month of that date, used as the Locktober day. */
  day: number
}

const HHMM = /^([01]\d|2[0-4]):([0-5]\d)$/

export function isValidSession(s: Partial<LoungeSessionDef>): s is LoungeSessionDef {
  if (!s || typeof s.name !== 'string' || !s.name.trim() || s.name.length > 30) return false
  if (typeof s.start !== 'string' || typeof s.end !== 'string') return false
  if (!HHMM.test(s.start) || !HHMM.test(s.end) || s.start === '24:00') return false
  if (s.start === s.end) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: s.tz })
    return true
  }
  catch { return false }
}

// Offset of `tz` from UTC at the instant `ms`, in milliseconds.
function tzOffset(ms: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ms))
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(ms / 1000) * 1000
}

/** UTC instant of a wall-clock time in a time zone. Hour 24 rolls to the next day. */
export function zonedToUtc(y: number, m: number, d: number, h: number, min: number, tz: string): number {
  const guess = Date.UTC(y, m - 1, d, h, min)
  let ms = guess - tzOffset(guess, tz)
  // Second pass settles times close to a daylight-saving switch.
  ms = guess - tzOffset(ms, tz)
  return ms
}

/** Local calendar date ("YYYY-MM-DD") of an instant in a time zone. */
export function localDate(ms: number, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms))
}

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/**
 * Concrete windows for every session whose local date lies within
 * [startsOn, endsOn] and near `now` (two days either side), sorted by start.
 */
export function windowsAround(
  sessions: LoungeSessionDef[],
  startsOn: string,
  endsOn: string,
  now: number,
): LoungeWindow[] {
  const out: LoungeWindow[] = []
  for (const s of sessions) {
    if (!isValidSession(s)) continue
    const today = localDate(now, s.tz)
    const [sh, sm] = s.start.split(':').map(Number) as [number, number]
    const [eh, em] = s.end.split(':').map(Number) as [number, number]
    for (let i = -2; i <= 2; i++) {
      const date = addDays(today, i)
      if (date < startsOn || date > endsOn) continue
      const [y, m, d] = date.split('-').map(Number) as [number, number, number]
      const start = zonedToUtc(y, m, d, sh, sm, s.tz)
      const rolls = eh * 60 + em <= sh * 60 + sm
      const end = zonedToUtc(y, m, d + (rolls ? 1 : 0), eh, em, s.tz)
      out.push({ name: s.name, start: new Date(start).toISOString(), end: new Date(end).toISOString(), date, day: d })
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start))
}

export interface LoungeSchedule {
  open: LoungeWindow | null
  next: LoungeWindow | null
  previous: LoungeWindow | null
}

export function scheduleAt(
  sessions: LoungeSessionDef[],
  startsOn: string,
  endsOn: string,
  now: number,
): LoungeSchedule {
  const windows = windowsAround(sessions, startsOn, endsOn, now)
  const t = new Date(now).toISOString()
  const open = windows.find(w => w.start <= t && t < w.end) ?? null
  let next = windows.find(w => w.start > t) ?? null
  // Before the first day the nearest window can be weeks away.
  if (!next && t.slice(0, 10) < startsOn) {
    next = windowsAround(sessions, startsOn, endsOn, new Date(`${startsOn}T12:00:00Z`).getTime())
      .find(w => w.start > t) ?? null
  }
  const previous = [...windows].reverse().find(w => w.end <= t) ?? null
  return { open, next, previous }
}

/** "3h 12m", "12m", "45s" until a moment. */
export function countdown(toIso: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((new Date(toIso).getTime() - now) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ${m % 60}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

// Links are not allowed in the lounge. Catches schemes, www. and bare
// domains with common endings; plain words with a dot do not match.
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]{2,}\.(com|net|org|io|me|co|xyz|ly|gg|app|link|to|tv|info|biz|cc|ru|de|uk|fans|club|site|online|shop|store)\b)/i

export function containsLink(text: string): boolean {
  return LINK.test(text)
}
