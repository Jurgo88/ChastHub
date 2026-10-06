// Planning of scheduled surprises, kept free of Nitro/Supabase so it can be
// unit tested. Randomness comes in through `rng` so tests can be deterministic.
import { shiftDate, localParts } from '~/server/utils/checkin'

export const MAX_SURPRISE_MESSAGE = 140
export const PLAN_DAYS = 7
/** A surprise this long overdue (lock was paused, cron down) is dropped instead of fired late. */
export const STALE_AFTER_MS = 24 * 3_600_000
/** Chance, when removing is allowed, that a surprise takes time off instead of adding it. */
export const REMOVE_CHANCE = 0.3

export interface SurpriseSettings {
  per_week: number
  min_minutes: number
  max_minutes: number
  allow_remove: boolean
  window_start: string
  window_end: string
  tz: string
  message: string | null
}

export interface PlannedSurprise { due_at: string; delta_minutes: number }

/** "08:30" or "08:30:00" to minutes since midnight, or null when malformed. */
export function parseClock(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  return h < 24 && min < 60 ? h * 60 + min : null
}

function offsetMs(at: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(at)
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(at / 1000) * 1000
}

/** The UTC instant at which the wall clock of `tz` reads `date` + `minutes`. */
export function zonedToUtc(date: string, minutes: number, tz: string): number {
  const [y, mo, d] = date.split('-').map(Number)
  const wall = Date.UTC(y!, mo! - 1, d!, 0, minutes)
  // Two passes settle the offset around a DST change.
  let guess = wall - offsetMs(wall, tz)
  guess = wall - offsetMs(guess, tz)
  return guess
}

/**
 * Concrete moments for the next PLAN_DAYS days after `fromMs`, inside the
 * daily window of the wearer's zone. Up to 7 a week land on different days;
 * more than that double up. Sorted, all after `fromMs`.
 */
export function planSurprises(s: SurpriseSettings, fromMs: number, rng: () => number = Math.random): PlannedSurprise[] {
  const start = parseClock(s.window_start)
  const end = parseClock(s.window_end)
  if (start === null || end === null || end <= start) return []

  const firstDay = localParts(fromMs, s.tz).date
  const days = Array.from({ length: PLAN_DAYS + 1 }, (_, i) => shiftDate(firstDay, i))

  // Pick days: shuffle, take per_week (cycling when it is more than the days).
  const pool: string[] = []
  while (pool.length < s.per_week) {
    const round = [...days.slice(0, PLAN_DAYS)]
    for (let i = round.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[round[i], round[j]] = [round[j]!, round[i]!]
    }
    pool.push(...round)
  }

  const out: PlannedSurprise[] = []
  for (const day of pool.slice(0, s.per_week)) {
    const minute = start + Math.floor(rng() * (end - start))
    const at = zonedToUtc(day, minute, s.tz)
    if (at <= fromMs) continue
    const steps = Math.floor((s.max_minutes - s.min_minutes) / 5)
    const raw = s.min_minutes + Math.floor(rng() * (steps + 1)) * 5
    const minutes = Math.min(s.max_minutes, Math.max(s.min_minutes, raw))
    const negative = s.allow_remove && rng() < REMOVE_CHANCE
    out.push({ due_at: new Date(at).toISOString(), delta_minutes: negative ? -minutes : minutes })
  }
  return out.sort((a, b) => a.due_at.localeCompare(b.due_at))
}

/** Text for the push and the chat line. */
export function surpriseText(deltaMinutes: number, custom: string | null): string {
  const m = Math.abs(deltaMinutes)
  const h = Math.floor(m / 60)
  const rest = m % 60
  const amount = h ? (rest ? `${h}h ${rest}m` : `${h}h`) : `${rest}m`
  const sign = deltaMinutes > 0 ? '+' : '-'
  if (custom?.trim()) return `${custom.trim()} (${sign}${amount})`
  return `Your keyholder had a little surprise for you: ${sign}${amount}`
}

/**
 * Applies a surprise to the end of the lock. Returns the new `loqed_until`
 * (ISO), or null when it must not be applied (would cut below one minute left).
 */
export function applySurprise(loqedUntil: string, deltaMinutes: number, now: number, maxTotalMinutes: number): string | null {
  const next = new Date(loqedUntil).getTime() + deltaMinutes * 60_000
  if (deltaMinutes < 0 && next < now + 60_000) return null
  return new Date(Math.min(next, now + maxTotalMinutes * 60_000)).toISOString()
}
