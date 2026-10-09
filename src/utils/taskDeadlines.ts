// Deadline shortcuts in the task form, worked out in the viewer's own zone.

export type DeadlineChoice = 'none' | '1h' | 'tonight' | 'tomorrow' | 'custom'

/** 22:00 today, or null once it is past 21:00 (too little time to be fair). */
export function tonight(now = new Date()): Date | null {
  const d = new Date(now)
  d.setHours(22, 0, 0, 0)
  return d.getTime() - now.getTime() >= 3_600_000 ? d : null
}

/** 22:00 tomorrow. */
export function tomorrowEvening(now = new Date()): Date {
  const d = new Date(now)
  d.setDate(d.getDate() + 1)
  d.setHours(22, 0, 0, 0)
  return d
}

/** ISO deadline for a choice; `custom` is a datetime-local value. */
export function deadlineFor(choice: DeadlineChoice, custom: string, now = new Date()): string | null {
  switch (choice) {
    case 'none': return null
    case '1h': return new Date(now.getTime() + 3_600_000).toISOString()
    case 'tonight': return tonight(now)?.toISOString() ?? null
    case 'tomorrow': return tomorrowEvening(now).toISOString()
    case 'custom': return custom ? new Date(custom).toISOString() : null
  }
}
