import { describe, it, expect } from 'vitest'
import {
  isValidDuration,
  isValidEmotion,
  computeLoqedUntil,
  MIN_DURATION_MINUTES,
  MAX_DURATION_MINUTES,
  MAX_EMOTION_LENGTH,
} from '~/server/utils/loqValidation'

describe('isValidDuration', () => {
  it('accepts the minimum (1 minute) and maximum (10 years)', () => {
    expect(isValidDuration(MIN_DURATION_MINUTES)).toBe(true)
    expect(isValidDuration(MAX_DURATION_MINUTES)).toBe(true)
    expect(MAX_DURATION_MINUTES).toBe(3650 * 24 * 60)
  })

  it('accepts a value inside the range', () => {
    expect(isValidDuration(60)).toBe(true)
  })

  it('rejects below the minimum', () => {
    expect(isValidDuration(0)).toBe(false)
    expect(isValidDuration(0.5)).toBe(false)
    expect(isValidDuration(-10)).toBe(false)
  })

  it('rejects above the maximum', () => {
    expect(isValidDuration(MAX_DURATION_MINUTES + 1)).toBe(false)
  })

  it('rejects non-finite and non-number values', () => {
    expect(isValidDuration(Number.NaN)).toBe(false)
    expect(isValidDuration(Number.POSITIVE_INFINITY)).toBe(false)
    expect(isValidDuration('60')).toBe(false)
    expect(isValidDuration(null)).toBe(false)
    expect(isValidDuration(undefined)).toBe(false)
  })
})

describe('isValidEmotion', () => {
  // TASK-070: free-form custom emoji, not a fixed preset list — this is now
  // just a sanity length bound (mirrored by the DB CHECK, migration 001).
  it('accepts any short non-empty string, old preset keys included', () => {
    expect(isValidEmotion('excited')).toBe(true) // legacy key, still a valid string
    expect(isValidEmotion('🤭')).toBe(true)
    expect(isValidEmotion('👨‍👩‍👧‍👦')).toBe(true) // multi-codepoint ZWJ family sequence
  })

  it('rejects empty and over-length values', () => {
    expect(isValidEmotion('')).toBe(false)
    expect(isValidEmotion('a'.repeat(MAX_EMOTION_LENGTH + 1))).toBe(false)
  })

  it('counts Unicode code points, not UTF-16 units', () => {
    // A single emoji can be >1 UTF-16 code unit (surrogate pairs) — make
    // sure the length check doesn't reject valid short emoji on that basis.
    expect('🤭'.length).toBeGreaterThan(1) // UTF-16 units
    expect(isValidEmotion('🤭')).toBe(true)
  })
})

describe('computeLoqedUntil', () => {
  it('adds the duration and returns a UTC ISO string', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    expect(computeLoqedUntil(now, 90)).toBe('2026-01-01T01:30:00.000Z')
  })

  it('is timezone-agnostic — the offset is applied in UTC milliseconds', () => {
    // A Date built from a local-time string still serialises to a UTC instant,
    // so the +1h result is stable regardless of the machine's timezone.
    const now = new Date(Date.UTC(2026, 5, 15, 23, 30, 0))
    expect(computeLoqedUntil(now, 60)).toBe('2026-06-16T00:30:00.000Z')
  })

  it('handles the maximum-duration window', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const expected = new Date(now.getTime() + MAX_DURATION_MINUTES * 60_000)
    expect(computeLoqedUntil(now, MAX_DURATION_MINUTES)).toBe(expected.toISOString())
  })
})
