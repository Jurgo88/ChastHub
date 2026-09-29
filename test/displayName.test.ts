import { describe, it, expect } from 'vitest'
import { generateDisplayName } from '~/server/utils/displayName'

describe('generateDisplayName', () => {
  it('produces a capitalised two-word name with a two-digit suffix', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateDisplayName()).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d{2}$/)
    }
  })

  it('stays inside the 50-character limit the profile PATCH route enforces', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateDisplayName().length).toBeLessThanOrEqual(50)
    }
  })

  it('never contains an @ — the point is to not look like an email', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateDisplayName()).not.toContain('@')
    }
  })

  it('varies between calls', () => {
    const names = new Set(Array.from({ length: 100 }, () => generateDisplayName()))
    expect(names.size).toBeGreaterThan(50)
  })
})
