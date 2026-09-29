// Pure, dependency-free validation helpers for loq creation. Kept out of the
// route handler so the rules (duration bounds, emotion enum) can be unit
// tested without a Nitro/Supabase harness. See test/loqValidation.test.ts.

export const MIN_DURATION_MINUTES = 1
// TASK-085: was 7 days — client wants it "unlimited or very high", citing
// real self-loqs running 400+ days. 10 years is the single ceiling every
// duration/time-adjust/visitor-vote check below defers to; raise this one
// constant rather than re-hardcoding a new number in five places again.
export const MAX_DURATION_MINUTES = 3650 * 24 * 60 // 10 years

// TASK-070: was a fixed 5-value enum ('excited'/'chill'/.../'hopeless') —
// client confirmed she wants free-form custom emoji instead of an expanded
// preset list. loqs.emotion now stores the emoji itself; this is just a
// sanity length bound, mirrored by the DB CHECK constraint (migration 001).
export const MIN_EMOTION_LENGTH = 1
export const MAX_EMOTION_LENGTH = 16

/**
 * A loq duration is valid when it is a finite number between 1 minute and
 * MAX_DURATION_MINUTES (inclusive). Non-numbers, NaN, Infinity, zero and
 * negatives are all rejected.
 */
export function isValidDuration(minutes: unknown): minutes is number {
  return typeof minutes === 'number'
    && Number.isFinite(minutes)
    && minutes >= MIN_DURATION_MINUTES
    && minutes <= MAX_DURATION_MINUTES
}

export function isValidEmotion(emotion: string): boolean {
  const len = [...emotion].length // code points, not UTF-16 units — matches char_length() in Postgres
  return len >= MIN_EMOTION_LENGTH && len <= MAX_EMOTION_LENGTH
}

/**
 * Clock starts at creation (TASK-062): the loq window closes `minutes` after
 * `now`. Returned as a UTC ISO string so storage/display stay timezone-safe.
 */
export function computeLoqedUntil(now: Date, minutes: number): string {
  return new Date(now.getTime() + minutes * 60_000).toISOString()
}
