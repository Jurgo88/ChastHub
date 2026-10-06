import { describe, expect, it } from 'vitest'
import {
  applySegment, isNotEasier, pickSegment, segmentArcs, segmentLabel, validateSegments, WHEEL_TEMPLATES,
  type WheelConfig, type WheelSegment,
} from '~/utils/wheel'

const seg = (type: WheelSegment['type'], weight = 1, extra: Partial<WheelSegment> = {}): WheelSegment => ({ type, weight, ...extra })
const four: WheelSegment[] = [seg('add', 1, { value: 60 }), seg('remove', 1, { value: 30 }), seg('nothing'), seg('task', 1, { text: 'Do a thing' })]

describe('validateSegments', () => {
  it('accepts a good wheel and cleans it up', () => {
    const r = validateSegments([...four.slice(0, 3), seg('task', 2, { text: '  Stretch  ' })])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.segments[3]).toEqual({ type: 'task', text: 'Stretch', weight: 2 })
  })

  it('needs 4 to 12 segments', () => {
    expect(validateSegments(four.slice(0, 3)).ok).toBe(false)
    expect(validateSegments(Array.from({ length: 13 }, () => seg('nothing'))).ok).toBe(false)
    expect(validateSegments('x').ok).toBe(false)
  })

  it('enforces the per-type limits', () => {
    const bad = (s: WheelSegment) => validateSegments([...four.slice(0, 3), s]).ok
    expect(bad(seg('add', 1, { value: 7 * 1440 }))).toBe(true)
    expect(bad(seg('add', 1, { value: 7 * 1440 + 1 }))).toBe(false)
    expect(bad(seg('remove', 1, { value: 1441 }))).toBe(false)
    expect(bad(seg('freeze', 1, { value: 3 * 1440 + 1 }))).toBe(false)
    expect(bad(seg('add', 1, { value: 0 }))).toBe(false)
    expect(bad(seg('add', 6, { value: 60 }))).toBe(false)
    expect(bad(seg('task', 1, { text: 'x' }))).toBe(false)
    expect(bad(seg('task', 1, { text: 'see https://evil.example' }))).toBe(false)
    expect(bad({ type: 'bogus' as never, weight: 1 })).toBe(false)
  })
})

describe('pickSegment', () => {
  it('follows the weights', () => {
    const segs = [seg('add', 1, { value: 60 }), seg('nothing', 3)]
    const counts = [0, 0]
    let s = 12345
    const rng = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
    for (let i = 0; i < 20000; i++) counts[pickSegment(segs, rng)]!++
    expect(counts[1]! / 20000).toBeGreaterThan(0.72)
    expect(counts[1]! / 20000).toBeLessThan(0.78)
  })

  it('handles the edges of the range', () => {
    const segs = [seg('nothing', 2), seg('nothing', 3)]
    expect(pickSegment(segs, () => 0)).toBe(0)
    expect(pickSegment(segs, () => 0.3999)).toBe(0)
    expect(pickSegment(segs, () => 0.4)).toBe(1)
    expect(pickSegment(segs, () => 0.9999999)).toBe(1)
  })
})

describe('segmentArcs', () => {
  it('splits 360 degrees by weight', () => {
    const arcs = segmentArcs([seg('nothing', 1), seg('nothing', 3)])
    expect(arcs[0]).toEqual({ start: 0, end: 90, mid: 45 })
    expect(arcs[1]).toEqual({ start: 90, end: 360, mid: 225 })
  })
})

describe('applySegment', () => {
  const now = new Date('2026-10-05T10:00:00Z').getTime()
  const until = new Date('2026-10-06T10:00:00Z').getTime()
  const MAX = 100000

  it('adds time', () => {
    const e = applySegment(seg('add', 1, { value: 120 }), until, now, MAX)
    expect(e).toMatchObject({ applied: true, deltaMinutes: 120, loqedUntil: until + 120 * 60_000 })
  })

  it('removes time but never below a minute left', () => {
    expect(applySegment(seg('remove', 1, { value: 60 }), until, now, MAX)).toMatchObject({ applied: true, deltaMinutes: -60 })
    const short = now + 30 * 60_000
    const e = applySegment(seg('remove', 1, { value: 60 }), short, now, MAX)
    expect(e.applied).toBe(false)
    expect(e.loqedUntil).toBe(short)
  })

  it('freezes by pushing the end back and records how long', () => {
    const e = applySegment(seg('freeze', 1, { value: 720 }), until, now, MAX)
    expect(e).toMatchObject({ applied: true, deltaMinutes: 720, loqedUntil: until + 720 * 60_000, frozenUntil: now + 720 * 60_000 })
  })

  it('stacks a freeze on a running one', () => {
    const running = now + 3_600_000
    const e = applySegment(seg('freeze', 1, { value: 60 }), until, now, MAX, running)
    expect(e.frozenUntil).toBe(running + 60 * 60_000)
  })

  it('respects the maximum total', () => {
    const e = applySegment(seg('add', 1, { value: 600 }), now + 60 * 60_000, now, 120)
    expect(e.deltaMinutes).toBe(60)
    expect(applySegment(seg('add', 1, { value: 600 }), now + 120 * 60_000, now, 120).applied).toBe(false)
  })

  it('leaves the lock alone for tasks and nothing', () => {
    expect(applySegment(seg('task', 1, { text: 'Do it' }), until, now, MAX)).toMatchObject({ applied: false, loqedUntil: until, note: 'Task: Do it' })
    expect(applySegment(seg('nothing'), until, now, MAX).applied).toBe(false)
  })
})

describe('isNotEasier', () => {
  const old: WheelConfig = { enabled: true, interval_minutes: 1440, segments: four }

  it('allows nothing changed and harder additions', () => {
    expect(isNotEasier(old, old)).toBe(true)
    expect(isNotEasier(old, { ...old, interval_minutes: 720, segments: [...four, seg('add', 2, { value: 600 })] })).toBe(true)
    expect(isNotEasier(old, { ...old, segments: [...four, seg('task', 1, { text: 'New one' })] })).toBe(true)
  })

  it('refuses anything softer', () => {
    expect(isNotEasier(old, { ...old, enabled: false })).toBe(false)
    expect(isNotEasier(old, { ...old, interval_minutes: 2880 })).toBe(false)
    expect(isNotEasier(old, { ...old, segments: [...four, seg('remove', 1, { value: 60 })] })).toBe(false)
    expect(isNotEasier(old, { ...old, segments: [...four, seg('nothing')] })).toBe(false)
    expect(isNotEasier(old, { ...old, segments: four.slice(1) })).toBe(false)
    expect(isNotEasier(old, { ...old, segments: [{ ...four[0]!, value: 30 }, ...four.slice(1)] })).toBe(false)
    expect(isNotEasier(old, { ...old, segments: [{ ...four[0]!, weight: 2 }, ...four.slice(1)] })).toBe(false)
  })
})

describe('templates and labels', () => {
  it('every template is a valid wheel', () => {
    for (const t of Object.values(WHEEL_TEMPLATES)) expect(validateSegments(t.segments).ok).toBe(true)
  })

  it('labels read well', () => {
    expect(segmentLabel(seg('add', 1, { value: 90 }))).toBe('+1h 30m')
    expect(segmentLabel(seg('remove', 1, { value: 60 }))).toBe('-1h')
    expect(segmentLabel(seg('freeze', 1, { value: 1440 }))).toBe('Freeze 1d')
    expect(segmentLabel(seg('nothing'))).toBe('Nothing')
  })
})
