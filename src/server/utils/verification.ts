// Verification-photo rules, kept free of Nitro/Supabase so they can be unit tested.

export const VERIFICATION_BUCKET = 'verification-photos'
export const VERIFICATION_STATUSES = ['pending', 'submitted', 'approved', 'rejected', 'expired', 'cancelled'] as const
export type VerificationStatus = typeof VERIFICATION_STATUSES[number]

/** No 0/O or 1/I: the code is written on paper and read off a photo. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 4

export const DUE_CHOICES_MINUTES = [30, 60, 120, 360] as const
export const MAX_PENALTY_MINUTES = 10080
/** A keyholder can ask this many times in 24 hours, so it cannot become harassment. */
export const MAX_REQUESTS_PER_DAY = 6
export const MAX_REVIEW_NOTE = 200
/** Photos are deleted this long after the lock is over. */
export const PHOTO_RETENTION_DAYS = 30

export function generateCode(randomInt: (max: number) => number): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return code
}

export function isValidCode(value: unknown): value is string {
  return typeof value === 'string' && value.length === CODE_LENGTH && [...value].every(c => CODE_ALPHABET.includes(c))
}

export function photoPath(loqId: string, verificationId: string): string {
  return `${loqId}/${verificationId}.jpg`
}

const TRANSITIONS: Record<VerificationStatus, readonly VerificationStatus[]> = {
  pending: ['submitted', 'expired', 'cancelled'],
  submitted: ['approved', 'rejected'],
  approved: [],
  rejected: [],
  expired: [],
  cancelled: [],
}

export function canTransition(from: VerificationStatus, to: VerificationStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

/** A request is open (blocks a new one) while it waits for a photo or a review. */
export const isOpen = (status: VerificationStatus) => status === 'pending' || status === 'submitted'

export function isPastDue(dueAt: string | number | Date, now = Date.now()): boolean {
  return new Date(dueAt).getTime() <= now
}

// ── Random daily schedule ──────────────────────────────────────────────────

export function isHHMM(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

export const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

/** Wall-clock parts of an instant in a zone. */
function zoneParts(at: number, tz: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at)
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value)
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), min: get('minute') }
}

/** The instant at which the wall clock in `tz` reads `date` `minuteOfDay`. */
export function zonedTimeToUtc(date: string, minuteOfDay: number, tz: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const wanted = Date.UTC(y, m - 1, d, 0, minuteOfDay)
  let guess = wanted
  // Two passes settle the offset, also across a daylight-saving change.
  for (let i = 0; i < 2; i++) {
    const p = zoneParts(guess, tz)
    guess += wanted - Date.UTC(p.y, p.m - 1, p.d, p.h, p.min)
  }
  return guess
}

/** A random instant inside [start, end) on `date` in `tz`. `rand` returns [0, 1). */
export function randomTimeInWindow(date: string, start: string, end: string, tz: string, rand: () => number): number {
  const from = toMinutes(start)
  const to = toMinutes(end)
  const minute = from + Math.floor(rand() * Math.max(1, to - from))
  return zonedTimeToUtc(date, minute, tz)
}

/** The next random request time after `now`: today if the roll is still ahead, else tomorrow. */
export function nextAutoTime(now: number, start: string, end: string, tz: string, rand: () => number): number {
  const p = zoneParts(now, tz)
  const pad = (n: number) => String(n).padStart(2, '0')
  const today = `${p.y}-${pad(p.m)}-${pad(p.d)}`
  const todays = randomTimeInWindow(today, start, end, tz, rand)
  if (todays > now) return todays
  const tomorrow = new Date(Date.UTC(p.y, p.m - 1, p.d + 1)).toISOString().slice(0, 10)
  return randomTimeInWindow(tomorrow, start, end, tz, rand)
}

/** Chat and push wording for a new request. */
export function requestMessage(code: string, dueMinutes: number): string {
  const h = Math.floor(dueMinutes / 60)
  const m = dueMinutes % 60
  const span = h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`
  return `📸 Verification requested: write ${code} on paper and take a photo of yourself with it. Due in ${span}.`
}
