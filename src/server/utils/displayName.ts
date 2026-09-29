import type { SupabaseClient } from '@supabase/supabase-js'

// Generated names for new accounts. Right after signup the user lands on
// /welcome, where they can keep this suggestion, roll another one, or type
// their own. The real name from Google is never used: display_name is public.
//
// The word lists are themed to the site and split by role, so a wearer rolls
// something like "CagedPet27" and a keyholder something like "StrictWarden41".
// Adult on purpose (it is an 18+ site), but nothing that names a body part or
// reads as a real first name.

type Role = 'loqee' | 'loqholder' | string

const WEARER_ADJECTIVES = [
  'Caged', 'Locked', 'Denied', 'Edged', 'Obedient', 'Desperate', 'Leashed',
  'Collared', 'Kneeling', 'Needy', 'Teased', 'Frustrated', 'Sealed', 'Chained',
  'Humble', 'Pleading', 'Aching', 'Restless', 'Eager', 'Devoted', 'Blushing',
  'Tamed', 'Bound', 'Squirming', 'Yearning', 'Owned', 'Pent', 'Helpless',
  'Willing', 'Trembling',
]

const WEARER_NOUNS = [
  'Pet', 'Toy', 'Captive', 'Sub', 'Brat', 'Plaything', 'Servant', 'Prisoner',
  'Pup', 'Kitten', 'Doll', 'Devotee', 'Ward', 'Bunny', 'Puppet', 'Hostage',
  'Minion', 'Pawn', 'Vessel', 'Keepsake',
]

const KEYHOLDER_ADJECTIVES = [
  'Strict', 'Cruel', 'Wicked', 'Stern', 'Merciless', 'Patient', 'Teasing',
  'Sly', 'Velvet', 'Iron', 'Cold', 'Sweet', 'Devious', 'Playful', 'Ruthless',
  'Smirking', 'Silent', 'Commanding', 'Wanton', 'Sultry', 'Unyielding',
  'Cunning', 'Relentless', 'Vicious', 'Gentle', 'Sadistic', 'Tempting',
  'Heartless', 'Regal', 'Watchful',
]

const KEYHOLDER_NOUNS = [
  'Keeper', 'Warden', 'Mistress', 'Master', 'Jailer', 'Captor', 'Owner',
  'Tease', 'Domme', 'Dom', 'Handler', 'Guardian', 'Queen', 'King', 'Overseer',
  'Sovereign', 'Goddess', 'Tyrant', 'Siren', 'Custodian',
]

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]!
}

export function generateDisplayName(role?: Role): string {
  const keyholder = role === 'loqholder'
  const adjective = pick(keyholder ? KEYHOLDER_ADJECTIVES : WEARER_ADJECTIVES)
  const noun = pick(keyholder ? KEYHOLDER_NOUNS : WEARER_NOUNS)
  const suffix = Math.floor(Math.random() * 90) + 10 // 10 to 99, always two digits
  return `${adjective}${noun}${suffix}`
}

/** "CagedPet27" becomes "caged_pet27", which fits the username rule. */
export function usernameFromDisplayName(displayName: string): string {
  return displayName
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20)
}

/**
 * A generated name that nobody else is currently using.
 *
 * `display_name` carries no unique constraint (two people are allowed to
 * collide, and a user can rename themselves into a collision anyway), so this
 * is a courtesy check, not a guarantee. After `attempts` tries it returns the
 * last candidate rather than failing a signup over a cosmetic clash.
 */
export async function generateUniqueDisplayName(
  supabase: SupabaseClient,
  role?: Role,
  attempts = 5,
): Promise<string> {
  let candidate = generateDisplayName(role)

  for (let i = 0; i < attempts; i++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .or(`display_name.eq.${candidate},username.eq.${usernameFromDisplayName(candidate)}`)
      .limit(1)
      .maybeSingle()

    // A lookup failure must not block signup: take the candidate as-is.
    if (error || !data) return candidate
    candidate = generateDisplayName(role)
  }

  return candidate
}
