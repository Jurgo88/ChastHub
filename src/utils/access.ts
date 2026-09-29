// Premium access rules, shared by the client (auto-imported) and server
// routes (explicit import from '~/utils/access').
//
// Access = a paid subscription OR a free trial that has not ended yet.
// The trial end is set by the database on signup (migration 079).

export const TRIAL_DAYS = 30

export interface AccessFields {
  subscription_status?: string | null
  trial_ends_at?: string | null
}

export function isTrialActive(p: AccessFields | null | undefined, now = Date.now()): boolean {
  if (!p?.trial_ends_at) return false
  return new Date(p.trial_ends_at).getTime() > now
}

export function hasPremiumAccess(p: AccessFields | null | undefined, now = Date.now()): boolean {
  return p?.subscription_status === 'active' || isTrialActive(p, now)
}

/** Whole days left in the trial, rounded up; 0 when there is no running trial. */
export function trialDaysLeft(p: AccessFields | null | undefined, now = Date.now()): number {
  if (!isTrialActive(p, now)) return 0
  return Math.ceil((new Date(p!.trial_ends_at!).getTime() - now) / 86_400_000)
}
