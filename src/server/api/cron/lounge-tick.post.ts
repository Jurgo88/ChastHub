import { timingSafeEqual } from 'node:crypto'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { getLoungeStatus, pingLounge } from '~/server/utils/lounge'
import { sendPushNotification } from '~/server/utils/sendPushNotification'

// Called every few minutes by netlify/functions/lounge-tick.mts. When a
// session has just opened it posts the opening lines once and sends the
// "Remind me" pushes for that session.
function authorized(header: string | undefined, key: string): boolean {
  if (!header?.startsWith('Bearer ') || !key) return false
  const a = Buffer.from(header.slice(7))
  const b = Buffer.from(key)
  return a.length === b.length && timingSafeEqual(a, b)
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  if (!authorized(getRequestHeader(event, 'authorization'), config.supabaseServiceKey as string)) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const supabase = useSupabaseAdmin()
  await supabase.from('lounge_reminders').delete().lt('session_start', new Date(Date.now() - 86_400_000).toISOString())

  const status = await getLoungeStatus()
  if (!status.enabled || !status.open) return { opened: false }

  const { data: logged } = await supabase
    .from('lounge_session_log')
    .upsert({ session_start: status.open.start, name: status.open.name }, { onConflict: 'session_start', ignoreDuplicates: true })
    .select('session_start')
  if (!logged?.length) return { opened: false, already: true }

  const lines: string[] = [`🔓 The ${status.open.name} session is open. Say hi.`]
  const { data: pulse } = await supabase.rpc('stats_pulse')
  const p = pulse as { locked_now?: number; locktober?: { survivors?: number; active?: boolean } } | null
  if (p?.locked_now) {
    const survivors = p.locktober?.active && p.locktober.survivors ? ` · ${p.locktober.survivors} Locktober survivors still going` : ''
    lines.push(`🔒 ${p.locked_now} ${p.locked_now === 1 ? 'person is' : 'people are'} locked right now${survivors}`)
  }
  await supabase.from('lounge_messages').insert(lines.map(content => ({ kind: 'system', content })))
  await pingLounge()

  const { data: reminders } = await supabase.from('lounge_reminders').select('user_id').eq('session_start', status.open.start)
  const body = status.question ? `Tonight's question: ${status.question.text}` : 'Come say hi.'
  for (const r of reminders ?? []) {
    await sendPushNotification(r.user_id, 'The Lounge is open', body, '/lounge')
  }
  await supabase.from('lounge_reminders').delete().eq('session_start', status.open.start)

  return { opened: true, reminders: reminders?.length ?? 0 }
})
