// TASK-138 — the reasons offered before an account is deleted.
//
// Shared by the dialog and by /api/profile/delete, which validates the
// submitted value against this list: the reason is written into audit_log
// and read back by admins, so it has to be a closed set rather than whatever
// the client happened to send. Add here, and it appears in both places.
//
// Changing a `value` orphans the rows already stored under the old one —
// labels are free to change, values are not.
export interface DeletionReason {
  value: string
  label: string
}

export const DELETION_REASONS: DeletionReason[] = [
  { value: 'too_expensive', label: 'It costs more than it is worth to me' },
  { value: 'not_using', label: 'I am not using it enough' },
  { value: 'taking_break', label: 'I just need a break' },
  { value: 'missing_features', label: 'It is missing something I need' },
  { value: 'technical_issues', label: 'Too many bugs or problems' },
  { value: 'bad_experience', label: 'A bad experience with someone here' },
  { value: 'privacy', label: 'Privacy concerns' },
  { value: 'other', label: 'Something else' },
]

export const DELETION_REASON_VALUES = DELETION_REASONS.map(r => r.value)

/** Longest free-text note accepted; anything beyond this is rejected, not cut. */
export const DELETION_NOTE_MAX = 500

export function deletionReasonLabel(value: string | null | undefined): string {
  if (!value) return '—'
  return DELETION_REASONS.find(r => r.value === value)?.label ?? value
}

// TASK-176 — the extra step some reasons get before the account goes.
//   report  → the problem is filed in Admin → Issues (as a bug or a
//             security report), tagged with the reason for leaving
//   note    → only "what was it?" — the answer is kept as the deletion note
//   null    → no extra step: price, not using it, a break. Nothing to fix,
//             and asking again would only be in the way.
// "bad_experience" is about a person, not a bug; reporting someone is
// TASK-174 and not built yet.
export type DeletionFollowUp =
  | { step: 'report', kind: 'bug' | 'security' }
  | { step: 'note' }
  | null

export function deletionFollowUp(reason: string, note: string): DeletionFollowUp {
  if (reason === 'technical_issues') return { step: 'report', kind: 'bug' }
  if (reason === 'privacy') return { step: 'report', kind: 'security' }
  // An unexplained "something else" tells us nothing; with a note it is enough.
  if ((reason === 'other' || reason === 'missing_features') && !note.trim()) return { step: 'note' }
  return null
}
