import type { SupabaseClient } from '@supabase/supabase-js'

// TASK-124 — every account used to be created with display_name NULL, so the
// UI and the leaderboard fell back to the local part of the user's email
// address. On a chastity/keyholding platform that publishes a real identity
// to strangers, so new accounts get a generated name instead and can rename
// themselves afterwards in the profile editor.
//
// Word lists are deliberately bland: nothing explicit, nothing that reads as
// a real first name, and nothing that collides with the product's own
// vocabulary (loq / loqee / loqholder / key), which would make a generated
// name look like a role or a staff account.

const ADJECTIVES = [
  'Amber', 'Azure', 'Bold', 'Brave', 'Bright', 'Calm', 'Clever', 'Cobalt',
  'Copper', 'Crimson', 'Curious', 'Dusky', 'Eager', 'Ember', 'Fearless',
  'Gentle', 'Gilded', 'Golden', 'Hidden', 'Indigo', 'Ivory', 'Jade', 'Keen',
  'Lucid', 'Lunar', 'Midnight', 'Mellow', 'Nimble', 'Noble', 'Northern',
  'Onyx', 'Patient', 'Quiet', 'Rapid', 'Restless', 'Sable', 'Scarlet',
  'Silent', 'Silver', 'Solar', 'Steady', 'Sterling', 'Stormy', 'Swift',
  'Teal', 'Tranquil', 'Velvet', 'Violet', 'Wandering', 'Wild',
]

const NOUNS = [
  'Albatross', 'Badger', 'Beacon', 'Bison', 'Comet', 'Condor', 'Coyote',
  'Crane', 'Cypress', 'Dune', 'Eagle', 'Ember', 'Falcon', 'Fern', 'Fox',
  'Glacier', 'Harbor', 'Hawk', 'Heron', 'Ibis', 'Jaguar', 'Kestrel', 'Lantern',
  'Lynx', 'Magpie', 'Marten', 'Meadow', 'Meteor', 'Nebula', 'Ocelot', 'Orbit',
  'Osprey', 'Otter', 'Panther', 'Petrel', 'Puma', 'Quartz', 'Raven', 'Ridge',
  'Sparrow', 'Spruce', 'Stallion', 'Summit', 'Swallow', 'Thistle', 'Tundra',
  'Vulture', 'Willow', 'Wolf', 'Wren',
]

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]!
}

export function generateDisplayName(): string {
  const suffix = Math.floor(Math.random() * 90) + 10 // 10–99, always two digits
  return `${pick(ADJECTIVES)}${pick(NOUNS)}${suffix}`
}

/**
 * A generated name that nobody else is currently using.
 *
 * `display_name` carries no unique constraint (two people are allowed to
 * collide, and a user can rename themselves into a collision anyway), so this
 * is a courtesy check, not a guarantee — after `attempts` tries it returns the
 * last candidate rather than failing a signup over a cosmetic clash.
 */
export async function generateUniqueDisplayName(
  supabase: SupabaseClient,
  attempts = 5,
): Promise<string> {
  let candidate = generateDisplayName()

  for (let i = 0; i < attempts; i++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('display_name', candidate)
      .maybeSingle()

    // A lookup failure must not block signup — take the candidate as-is.
    if (error || !data) return candidate
    candidate = generateDisplayName()
  }

  return candidate
}
