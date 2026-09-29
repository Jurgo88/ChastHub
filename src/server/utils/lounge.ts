import type { AdminLevel, LoungeStatus } from '~/types'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { type LoungeSessionDef, isValidSession, scheduleAt } from '~/utils/loungeSchedule'

export interface LoungeSettingsRow {
  enabled: boolean
  starts_on: string
  ends_on: string
  sessions: LoungeSessionDef[]
  slow_mode_seconds: number
  min_account_age_hours: number
}

export const LOUNGE_CHANNEL = 'lounge'
export const LOUNGE_MAX_LENGTH = 500

export async function getLoungeSettings(): Promise<LoungeSettingsRow> {
  const { data } = await useSupabaseAdmin()
    .from('lounge_settings')
    .select('enabled, starts_on, ends_on, sessions, slow_mode_seconds, min_account_age_hours')
    .eq('id', 1)
    .maybeSingle<LoungeSettingsRow>()
  return data ?? {
    enabled: false,
    starts_on: '2026-10-01',
    ends_on: '2026-10-31',
    sessions: [],
    slow_mode_seconds: 10,
    min_account_age_hours: 24,
  }
}

export function isLoungeModerator(level: AdminLevel | null | undefined): boolean {
  return level === 'support' || level === 'super_admin'
}

export async function getLoungeStatus(now = Date.now(), settings?: LoungeSettingsRow): Promise<LoungeStatus> {
  const s = settings ?? await getLoungeSettings()
  const sessions = (Array.isArray(s.sessions) ? s.sessions : []).filter(isValidSession)
  const { open, next, previous } = scheduleAt(sessions, s.starts_on, s.ends_on, now)

  // In the menu from a day before the first session until a day after the last.
  const soon = next && new Date(next.start).getTime() - now < 36 * 3_600_000
  const recent = previous && now - new Date(previous.end).getTime() < 24 * 3_600_000
  const visible = s.enabled && !!(open || soon || recent)

  const day = open?.day ?? next?.day ?? null
  let question: LoungeStatus['question'] = null
  if (s.enabled && day) {
    const { data } = await useSupabaseAdmin().from('lounge_questions').select('day, text').eq('day', day).maybeSingle()
    if (data) question = { day: data.day, text: data.text }
  }

  let last: LoungeStatus['last_session'] = null
  if (s.enabled && previous && !open) {
    const { data } = await useSupabaseAdmin()
      .from('lounge_messages')
      .select('user_id')
      .eq('kind', 'user')
      .gte('created_at', previous.start)
      .lt('created_at', previous.end)
      .limit(5000)
    const rows = data ?? []
    last = { people: new Set(rows.map(r => r.user_id)).size, messages: rows.length }
  }

  return {
    enabled: s.enabled,
    visible,
    open,
    next,
    previous,
    question,
    last_session: last,
    slow_mode_seconds: s.slow_mode_seconds,
    sessions,
  }
}

export async function isLoungeOpen(now = Date.now()): Promise<boolean> {
  const s = await getLoungeSettings()
  if (!s.enabled) return false
  const sessions = (Array.isArray(s.sessions) ? s.sessions : []).filter(isValidSession)
  return !!scheduleAt(sessions, s.starts_on, s.ends_on, now).open
}

/** Tell every open Lounge to fetch. The payload carries no content on purpose. */
export async function pingLounge(payload: Record<string, unknown> = {}) {
  const supabase = useSupabaseAdmin()
  const channel = supabase.channel(LOUNGE_CHANNEL)
  try { await channel.httpSend('update', { ...payload, at: Date.now() }) }
  catch { /* best effort, clients also poll */ }
  finally { await supabase.removeChannel(channel) }
}

/**
 * Posts an automatic line ("A visitor added +2h to a Key Drop lock") while a
 * session is open. `throttleKey` keeps bursts to one line per window.
 */
export async function postLoungeEvent(content: string, throttleKey?: string, windowMs = 10 * 60_000) {
  try {
    if (!await isLoungeOpen()) return
    if (throttleKey && !await checkRateLimit(`lounge-event:${throttleKey}`, 1, windowMs)) return
    await useSupabaseAdmin().from('lounge_messages').insert({ kind: 'system', content: content.slice(0, LOUNGE_MAX_LENGTH) })
    await pingLounge()
  }
  catch (err) {
    console.error('[lounge] event failed', err)
  }
}
