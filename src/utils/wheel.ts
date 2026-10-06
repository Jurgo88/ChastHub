// Wheel of fortune rules, shared by the API (which draws and applies the
// result) and the UI (which only draws the wheel and animates to the result it
// is given). No Nitro/Supabase in here so it can be unit tested.

export type WheelSegmentType = 'add' | 'remove' | 'freeze' | 'task' | 'nothing'

export interface WheelSegment {
  type: WheelSegmentType
  /** Minutes, for add / remove / freeze. */
  value?: number
  /** Task text, for task. */
  text?: string
  /** 1 to 5, the chance relative to the other segments. */
  weight: number
}

export const MIN_SEGMENTS = 4
export const MAX_SEGMENTS = 12
export const MAX_WEIGHT = 5
export const MAX_TASK_TEXT = 140
/** Longest a single segment may move the lock, in minutes. */
export const SEGMENT_LIMITS = { add: 7 * 1440, remove: 1440, freeze: 3 * 1440 } as const
export const MIN_INTERVAL_MINUTES = 60
export const MAX_INTERVAL_MINUTES = 10080

export const SEGMENT_TYPES: readonly WheelSegmentType[] = ['add', 'remove', 'freeze', 'task', 'nothing']

function span(minutes: number): string {
  const d = Math.floor(minutes / 1440)
  const h = Math.floor((minutes % 1440) / 60)
  const m = minutes % 60
  const parts = [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean)
  return parts.length ? parts.join(' ') : '0m'
}

export function segmentLabel(s: WheelSegment): string {
  switch (s.type) {
    case 'add': return `+${span(s.value ?? 0)}`
    case 'remove': return `-${span(s.value ?? 0)}`
    case 'freeze': return `Freeze ${span(s.value ?? 0)}`
    case 'task': return s.text ?? 'Task'
    default: return 'Nothing'
  }
}

export type SegmentsResult = { ok: true; segments: WheelSegment[] } | { ok: false; error: string }

/** Checks a list from the outside world and returns it cleaned up. */
export function validateSegments(input: unknown): SegmentsResult {
  if (!Array.isArray(input)) return { ok: false, error: 'segments must be a list' }
  if (input.length < MIN_SEGMENTS || input.length > MAX_SEGMENTS) {
    return { ok: false, error: `The wheel needs ${MIN_SEGMENTS} to ${MAX_SEGMENTS} segments` }
  }

  const out: WheelSegment[] = []
  for (const raw of input) {
    const s = raw as Partial<WheelSegment> | null
    if (!s || typeof s !== 'object' || !SEGMENT_TYPES.includes(s.type as WheelSegmentType)) {
      return { ok: false, error: 'Unknown segment type' }
    }
    const weight = s.weight
    if (typeof weight !== 'number' || !Number.isInteger(weight) || weight < 1 || weight > MAX_WEIGHT) {
      return { ok: false, error: `Weight must be a whole number from 1 to ${MAX_WEIGHT}` }
    }

    const type = s.type as WheelSegmentType
    if (type === 'add' || type === 'remove' || type === 'freeze') {
      const max = SEGMENT_LIMITS[type]
      if (typeof s.value !== 'number' || !Number.isInteger(s.value) || s.value < 1 || s.value > max) {
        return { ok: false, error: `${type} must be 1 to ${max} minutes` }
      }
      out.push({ type, value: s.value, weight })
    }
    else if (type === 'task') {
      const text = typeof s.text === 'string' ? s.text.trim() : ''
      if (text.length < 2 || text.length > MAX_TASK_TEXT) {
        return { ok: false, error: `A task needs 2 to ${MAX_TASK_TEXT} characters` }
      }
      if (/https?:\/\/|www\./i.test(text)) return { ok: false, error: 'Links are not allowed in tasks' }
      out.push({ type, text, weight })
    }
    else {
      out.push({ type, weight })
    }
  }
  return { ok: true, segments: out }
}

/** Weighted draw. `rng` returns a number in [0, 1). */
export function pickSegment(segments: WheelSegment[], rng: () => number): number {
  const total = segments.reduce((sum, s) => sum + s.weight, 0)
  let roll = rng() * total
  for (let i = 0; i < segments.length; i++) {
    roll -= segments[i]!.weight
    if (roll < 0) return i
  }
  return segments.length - 1
}

export interface SegmentArc { start: number; end: number; mid: number }

/** Degrees each segment covers, clockwise from the top. Weight decides the size. */
export function segmentArcs(segments: WheelSegment[]): SegmentArc[] {
  const total = segments.reduce((sum, s) => sum + s.weight, 0) || 1
  let at = 0
  return segments.map((s) => {
    const size = (s.weight / total) * 360
    const arc = { start: at, end: at + size, mid: at + size / 2 }
    at += size
    return arc
  })
}

export interface SegmentEffect {
  /** False when the segment could not change the lock (e.g. removing too much). */
  applied: boolean
  loqedUntil: number
  frozenUntil: number | null
  deltaMinutes: number
  note: string
}

/**
 * What a segment does to the end of the lock. A removal never leaves less than
 * a minute on the clock, an addition never goes past `maxTotalMinutes` from
 * now. A freeze pushes the end back by its length, so the time left stays put
 * and everything that counts time keeps working unchanged.
 */
export function applySegment(
  s: WheelSegment,
  loqedUntil: number,
  now: number,
  maxTotalMinutes: number,
  frozenUntil: number | null = null,
): SegmentEffect {
  const same = (note: string): SegmentEffect => ({ applied: false, loqedUntil, frozenUntil, deltaMinutes: 0, note })
  const cap = now + maxTotalMinutes * 60_000

  if (s.type === 'add' || s.type === 'freeze') {
    const minutes = s.value ?? 0
    const next = Math.min(loqedUntil + minutes * 60_000, cap)
    const delta = Math.round((next - loqedUntil) / 60_000)
    if (delta <= 0) return same('The lock is already at the longest it can be.')
    if (s.type === 'add') return { applied: true, loqedUntil: next, frozenUntil, deltaMinutes: delta, note: segmentLabel(s) }
    const from = frozenUntil && frozenUntil > now ? frozenUntil : now
    return { applied: true, loqedUntil: next, frozenUntil: from + delta * 60_000, deltaMinutes: delta, note: `Frozen for ${span(delta)}` }
  }

  if (s.type === 'remove') {
    const next = loqedUntil - (s.value ?? 0) * 60_000
    if (next < now + 60_000) return same('Not enough time left to take off.')
    return { applied: true, loqedUntil: next, frozenUntil, deltaMinutes: -(s.value ?? 0), note: segmentLabel(s) }
  }

  if (s.type === 'task') return same(`Task: ${s.text ?? ''}`)
  return same('Nothing happens.')
}

export interface WheelConfig { segments: WheelSegment[]; interval_minutes: number; enabled: boolean }

const sameSegment = (a: WheelSegment, b: WheelSegment) =>
  a.type === b.type && (a.value ?? 0) === (b.value ?? 0) && (a.text ?? '') === (b.text ?? '') && a.weight === b.weight

/**
 * A self-lock wheel is locked after its first spin: the wearer may then only
 * make it harder. Every old segment must stay as it is, anything new must be
 * add / freeze / task, the interval may not grow and it may not be switched off.
 */
export function isNotEasier(old: WheelConfig, next: WheelConfig): boolean {
  if (!next.enabled && old.enabled) return false
  if (next.interval_minutes > old.interval_minutes) return false

  const left = [...next.segments]
  for (const o of old.segments) {
    const at = left.findIndex(n => sameSegment(o, n))
    if (at === -1) return false
    left.splice(at, 1)
  }
  return left.every(n => n.type === 'add' || n.type === 'freeze' || n.type === 'task')
}

export const WHEEL_TEMPLATES: Record<'gentle' | 'strict' | 'locktober', { label: string; segments: WheelSegment[] }> = {
  gentle: {
    label: 'Gentle',
    segments: [
      { type: 'add', value: 60, weight: 3 },
      { type: 'add', value: 120, weight: 2 },
      { type: 'remove', value: 60, weight: 2 },
      { type: 'nothing', weight: 3 },
      { type: 'freeze', value: 360, weight: 1 },
      { type: 'task', text: 'Send your keyholder a message', weight: 1 },
    ],
  },
  strict: {
    label: 'Strict',
    segments: [
      { type: 'add', value: 180, weight: 3 },
      { type: 'add', value: 360, weight: 3 },
      { type: 'add', value: 720, weight: 2 },
      { type: 'add', value: 1440, weight: 1 },
      { type: 'nothing', weight: 2 },
      { type: 'remove', value: 60, weight: 1 },
      { type: 'freeze', value: 720, weight: 1 },
      { type: 'task', text: 'Do what your keyholder asks today', weight: 1 },
    ],
  },
  locktober: {
    label: 'Locktober',
    segments: [
      { type: 'add', value: 120, weight: 3 },
      { type: 'add', value: 360, weight: 2 },
      { type: 'add', value: 1440, weight: 1 },
      { type: 'remove', value: 120, weight: 1 },
      { type: 'nothing', weight: 3 },
      { type: 'freeze', value: 720, weight: 1 },
      { type: 'task', text: 'Share your streak in the Lounge', weight: 1 },
    ],
  },
}
