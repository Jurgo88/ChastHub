// Issue #24 — what the lock dashboards show about a lock, derived from its
// times and its signals (server/utils/lockSignals.ts). Pure so it can be unit
// tested; `now` is passed in.

import type { LockSignals } from '~/types'

export type LockTab = 'overview' | 'tasks' | 'proof' | 'chat' | 'wheel' | 'surprises' | 'history'
export const LOCK_TABS: readonly LockTab[] = ['overview', 'tasks', 'proof', 'chat', 'wheel', 'surprises', 'history']

export type SignalTone = 'ok' | 'warn' | 'due' | 'idle'
export interface SignalChip { label: string; tone: SignalTone }

interface LockTimes {
  created_at: string
  loqed_until: string | null
  paused_at?: string | null
}

const DAY = 86_400_000

/** Share of the lock already served, 0–100. The clock runs from creation. */
export function lockProgress(lock: LockTimes, now = Date.now()): number {
  if (!lock.loqed_until) return 0
  const start = new Date(lock.created_at).getTime()
  const end = new Date(lock.loqed_until).getTime()
  const at = lock.paused_at ? new Date(lock.paused_at).getTime() : now
  if (end <= start) return 100
  return Math.round(Math.min(100, Math.max(0, ((at - start) / (end - start)) * 100)))
}

/** "20:00" today, "Sat 20:00" within a week, "11 Oct, 20:00" further out. */
export function clockLabel(iso: string, now = Date.now()): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === new Date(now).toDateString()) return time
  if (Math.abs(d.getTime() - now) < 6 * DAY) return `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time}`
}

/** The line under a lock's countdown. */
export function endsLabel(lock: LockTimes, now = Date.now()): string {
  if (!lock.loqed_until) return ''
  const pct = lockProgress(lock, now)
  if (lock.paused_at) return `Paused · ${pct}% done`
  return `Ends ${clockLabel(lock.loqed_until, now)} · ${pct}% done`
}

/** Up to `max` chips for a lock card, most urgent first. */
export function lockSignalChips(s: Partial<LockSignals> | null | undefined, max = 3, now = Date.now()): SignalChip[] {
  if (!s) return []
  const chips: SignalChip[] = []
  if (s.pending_verifications) chips.push({ label: s.pending_verifications > 1 ? `${s.pending_verifications} photos to review` : 'Photo to review', tone: 'warn' })
  if (s.submitted_tasks) chips.push({ label: s.submitted_tasks > 1 ? `${s.submitted_tasks} task proofs sent` : 'Task proof sent', tone: 'warn' })
  if (s.missed_checkin) chips.push({ label: 'Missed check-in', tone: 'due' })
  if (s.open_verification?.status === 'pending') chips.push({ label: `Photo due ${clockLabel(s.open_verification.due_at, now)}`, tone: 'idle' })
  if (s.next_task_due_at) {
    const overdue = new Date(s.next_task_due_at).getTime() <= now
    chips.push({ label: overdue ? 'Task overdue' : `Task due ${clockLabel(s.next_task_due_at, now)}`, tone: 'due' })
  }
  if (s.checked_in_today) chips.push({ label: 'Checked in today', tone: 'ok' })
  if (!chips.length) chips.push({ label: 'All caught up', tone: 'ok' })
  return chips.slice(0, max)
}

/** How many things on this lock wait on the keyholder. */
export function waitingCount(s: Partial<LockSignals> | null | undefined): number {
  return (s?.pending_verifications ?? 0) + (s?.submitted_tasks ?? 0)
}

export type TodayTarget = 'verification' | 'task' | 'checkin'

export interface NextUp {
  target: TodayTarget
  title: string
  detail: string
  due_at: string | null
  action: string
  code?: string
}

/**
 * The one thing the wearer should do next: a requested photo, then the task
 * with the nearest deadline, then a compulsory check-in, then any open task.
 */
export function wearerNextUp(s: Partial<LockSignals> | null | undefined, checkinRequired: boolean): NextUp | null {
  if (!s) return null
  const v = s.open_verification
  if (v?.status === 'pending') {
    return { target: 'verification', title: 'Verification photo', detail: 'Write this code on paper and take a photo of yourself with it.', due_at: v.due_at, action: 'Take photo', code: v.code }
  }
  const open = (s.open_tasks ?? []).filter(t => t.status === 'open')
  const dated = open.find(t => t.due_at)
  const task = (t: typeof open[number]): NextUp => ({
    target: 'task',
    title: t.text,
    detail: t.proof === 'photo' ? 'Needs a photo as proof.' : t.proof === 'text' ? 'Needs a few words as proof.' : 'Mark it done when it is.',
    due_at: t.due_at,
    action: t.proof === 'photo' ? 'Take photo' : 'Mark as done',
  })
  if (dated) return task(dated)
  if (checkinRequired && !s.checked_in_today) {
    return { target: 'checkin', title: 'Daily check-in', detail: 'Your keyholder requires it today.', due_at: null, action: 'Check in' }
  }
  return open[0] ? task(open[0]) : null
}

export interface TodayItem {
  key: string
  target: TodayTarget
  label: string
  meta: string
  state: 'done' | 'todo' | 'waiting'
}

/** The wearer's list for today: check-in, open photo request, open tasks. */
export function wearerToday(s: Partial<LockSignals> | null | undefined, checkinRequired: boolean, now = Date.now()): TodayItem[] {
  if (!s) return []
  const items: TodayItem[] = []
  if (s.checked_in_today) {
    items.push({ key: 'checkin', target: 'checkin', label: 'Daily check-in', meta: s.last_checkin_at ? clockLabel(s.last_checkin_at, now) : 'Done', state: 'done' })
  }
  else {
    items.push({ key: 'checkin', target: 'checkin', label: 'Daily check-in', meta: checkinRequired ? 'Required' : 'Optional', state: 'todo' })
  }
  const v = s.open_verification
  if (v) {
    items.push(v.status === 'submitted'
      ? { key: `v-${v.id}`, target: 'verification', label: 'Verification photo', meta: 'Waiting for your keyholder', state: 'waiting' }
      : { key: `v-${v.id}`, target: 'verification', label: 'Verification photo', meta: `Due ${clockLabel(v.due_at, now)}`, state: 'todo' })
  }
  for (const t of s.open_tasks ?? []) {
    items.push(t.status === 'submitted'
      ? { key: `t-${t.id}`, target: 'task', label: t.text, meta: 'Waiting for your keyholder', state: 'waiting' }
      : { key: `t-${t.id}`, target: 'task', label: t.text, meta: t.due_at ? `Due ${clockLabel(t.due_at, now)}` : 'No deadline', state: 'todo' })
  }
  return items
}
