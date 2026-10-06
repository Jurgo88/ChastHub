// Lock milestones, kept free of Nitro/Supabase so they can be unit tested.

export const MILESTONE_KEYS = ['24h', '3d', '7d', 'half', 'last_day', '14d', '30d'] as const
export type MilestoneKey = typeof MILESTONE_KEYS[number]

/** Elapsed hours at which the fixed milestones are reached. */
const FIXED_HOURS: Partial<Record<MilestoneKey, number>> = { '24h': 24, '3d': 72, '7d': 168, '14d': 336, '30d': 720 }

/** "Half" and "last day" only make sense on a lock long enough for them to mean something. */
const HALF_MIN_TOTAL_HOURS = 48
const LAST_DAY_MIN_TOTAL_HOURS = 72

/**
 * Milestones reached so far. `elapsedHours` is the time counted like Stats does
 * (created_at, a pause stops the clock), `totalHours` the planned length now
 * (it grows when time is added, so a later "half" is simply reached later).
 */
export function reachedMilestones(elapsedHours: number, totalHours: number): MilestoneKey[] {
  const out: MilestoneKey[] = []
  for (const key of MILESTONE_KEYS) {
    const fixed = FIXED_HOURS[key]
    if (fixed !== undefined) {
      if (elapsedHours >= fixed) out.push(key)
    }
    else if (key === 'half') {
      if (totalHours >= HALF_MIN_TOTAL_HOURS && elapsedHours >= totalHours / 2) out.push(key)
    }
    else if (key === 'last_day') {
      if (totalHours >= LAST_DAY_MIN_TOTAL_HOURS && totalHours - elapsedHours <= 24 && elapsedHours < totalHours) out.push(key)
    }
  }
  return out
}

export const MILESTONE_COPY: Record<MilestoneKey, { title: string; text: string }> = {
  '24h': { title: 'One day', text: 'The first 24 hours are behind you.' },
  '3d': { title: 'Three days', text: 'Three days in. The hard part is settling in.' },
  '7d': { title: 'One week', text: 'One week. Most people quit before this.' },
  half: { title: 'Halfway', text: 'Half of the lock is done.' },
  last_day: { title: 'Last day', text: 'Less than 24 hours left. Almost there.' },
  '14d': { title: 'Two weeks', text: 'Two weeks locked. Seriously impressive.' },
  '30d': { title: 'Thirty days', text: 'A whole month. Legendary.' },
}

export function isMilestoneKey(value: unknown): value is MilestoneKey {
  return typeof value === 'string' && (MILESTONE_KEYS as readonly string[]).includes(value)
}
