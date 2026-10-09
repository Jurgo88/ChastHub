// Keyholder task rules, kept free of Nitro/Supabase so they can be unit tested.
import { containsLink } from '~/utils/loungeSchedule'

export const TASK_PROOFS = ['none', 'text', 'photo'] as const
export type TaskProof = typeof TASK_PROOFS[number]
export const TASK_STATUSES = ['open', 'submitted', 'done', 'failed', 'cancelled'] as const
export type TaskStatus = typeof TASK_STATUSES[number]

export const MAX_TASK_TEXT = 300
export const MIN_TASK_TEXT = 2
export const MAX_PROOF_TEXT = 1000
export const MAX_REWARD_MINUTES = 1440
export const MAX_TASK_PENALTY_MINUTES = 4320
export const MAX_OPEN_TASKS = 10
export const MAX_TEMPLATES = 50
/** A submitted task the keyholder ignores this long is approved for them. */
export const AUTO_APPROVE_AFTER_MS = 24 * 3_600_000
/** The wearer is reminded this long before the deadline. */
export const REMINDER_BEFORE_MS = 3_600_000
/** Deadlines further out than this are refused. */
export const MAX_DUE_AHEAD_MS = 30 * 86_400_000

const TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  open: ['submitted', 'done', 'failed', 'cancelled'],
  submitted: ['done', 'failed'],
  done: [],
  failed: [],
  cancelled: [],
}

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export const isOpenTask = (s: TaskStatus) => s === 'open' || s === 'submitted'

export function isProof(value: unknown): value is TaskProof {
  return typeof value === 'string' && (TASK_PROOFS as readonly string[]).includes(value)
}

const isWhole = (v: unknown, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max

export interface TaskInput {
  text: string
  proof: TaskProof
  reward_minutes: number
  penalty_minutes: number
}

/** Validates the fields shared by a task and a template. Returns the clean input or an error message. */
export function parseTaskInput(body: Record<string, unknown> | null | undefined): TaskInput | string {
  const text = typeof body?.text === 'string' ? body.text.trim().replace(/\s+/g, ' ') : ''
  if (text.length < MIN_TASK_TEXT || text.length > MAX_TASK_TEXT) return `Task text must be ${MIN_TASK_TEXT} to ${MAX_TASK_TEXT} characters`
  if (containsLink(text)) return 'Links are not allowed in tasks'
  const proof = body?.proof === undefined ? 'none' : body.proof
  if (!isProof(proof)) return 'proof must be none, text or photo'
  const reward = body?.reward_minutes === undefined ? 0 : body.reward_minutes
  const penalty = body?.penalty_minutes === undefined ? 0 : body.penalty_minutes
  if (!isWhole(reward, MAX_REWARD_MINUTES)) return `reward_minutes must be a whole number from 0 to ${MAX_REWARD_MINUTES}`
  if (!isWhole(penalty, MAX_TASK_PENALTY_MINUTES)) return `penalty_minutes must be a whole number from 0 to ${MAX_TASK_PENALTY_MINUTES}`
  return { text, proof, reward_minutes: reward, penalty_minutes: penalty }
}

/** A deadline is optional; when given it must be ahead of now and within 30 days. */
export function parseDue(value: unknown, now = Date.now()): string | null | { error: string } {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') return { error: 'due_at must be a date' }
  const t = Date.parse(value)
  if (Number.isNaN(t)) return { error: 'due_at must be a date' }
  if (t <= now + 60_000) return { error: 'The deadline must be in the future' }
  if (t > now + MAX_DUE_AHEAD_MS) return { error: 'The deadline can be at most 30 days ahead' }
  return new Date(t).toISOString()
}

/** On a self-lock rewards do nothing (you cannot let yourself off), penalties still apply. */
export function effectiveReward(rewardMinutes: number, selfLock: boolean): number {
  return selfLock ? 0 : rewardMinutes
}

export function isMissed(task: { status: string; due_at: string | null }, now = Date.now()): boolean {
  return task.status === 'open' && !!task.due_at && Date.parse(task.due_at) <= now
}

export function taskReminderDue(task: { status: string; due_at: string | null; reminded_at: string | null }, now = Date.now()): boolean {
  if (task.status !== 'open' || !task.due_at || task.reminded_at) return false
  const due = Date.parse(task.due_at)
  return due > now && due - now <= REMINDER_BEFORE_MS
}

export function autoApproveDue(task: { status: string; submitted_at: string | null }, now = Date.now()): boolean {
  return task.status === 'submitted' && !!task.submitted_at && now - Date.parse(task.submitted_at) >= AUTO_APPROVE_AFTER_MS
}

export function taskPhotoPath(loqId: string, taskId: string): string {
  return `${loqId}/tasks/${taskId}.jpg`
}

/** "2h", "1h 30m", "45m". */
export function shortSpan(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`
}

const clip = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export function newTaskMessage(text: string, dueAt: string | null): string {
  return `📝 New task: ${clip(text)}${dueAt ? ' (deadline set)' : ''}`
}

export function doneMessage(text: string, appliedMinutes: number): string {
  return `✅ Task done: ${clip(text)}${appliedMinutes < 0 ? `, -${shortSpan(-appliedMinutes)}` : ''}`
}

export function failedMessage(text: string, appliedMinutes: number, missed: boolean): string {
  return `❌ Task ${missed ? 'missed' : 'failed'}: ${clip(text)}${appliedMinutes > 0 ? `, +${shortSpan(appliedMinutes)}` : ''}`
}
