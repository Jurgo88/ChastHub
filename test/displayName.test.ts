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

describe('role-themed names and usernames', () => {
  it('builds a valid username from every generated name', async () => {
    const { usernameFromDisplayName } = await import('~/server/utils/displayName')
    for (let i = 0; i < 500; i++) {
      for (const role of ['loqee', 'loqholder']) {
        const u = usernameFromDisplayName(generateDisplayName(role))
        expect(u).toMatch(/^[a-z][a-z0-9_]{2,19}$/)
      }
    }
  })

  it('splits camel case with an underscore', async () => {
    const { usernameFromDisplayName } = await import('~/server/utils/displayName')
    expect(usernameFromDisplayName('CagedPet27')).toBe('caged_pet27')
  })
})
