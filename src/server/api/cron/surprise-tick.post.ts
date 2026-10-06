import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireCronAuth } from '~/server/utils/cronAuth'
import { sendPushNotification } from '~/server/utils/sendPushNotification'
import { logAudit } from '~/server/utils/auditLog'
import { MAX_DURATION_MINUTES } from '~/server/utils/loqValidation'
import { STALE_AFTER_MS, applySurprise, planSurprises, surpriseText, type SurpriseSettings } from '~/server/utils/surprises'

// Called every few minutes by netlify/functions/lounge-tick.mts.
//   1. Executes the surprises that are due on running locks: moves the end of
//      the lock, writes the audit log, tells the wearer in chat and by push.
//   2. Keeps the plan topped up: when less than a day of plan is left it
//      plans another week after it.
// A paused lock waits: its surprises stay due and fire after the resume, or
// are dropped when they are more than a day late.
export default defineEventHandler(async (event) => {
  requireCronAuth(event)

  const supabase = useSupabaseAdmin()
  const now = Date.now()
  let executed = 0
  let planned = 0

  const { data: due } = await supabase
    .from('loq_surprises')
    .select('id, loq_id, due_at, delta_minutes')
    .is('executed_at', null)
    .is('cancelled_at', null)
    .lte('due_at', new Date(now).toISOString())
    .order('due_at', { ascending: true })
    .limit(500)

  for (const s of due ?? []) {
    const { data: loq } = await supabase
      .from('loqs')
      .select('id, loqee_id, loqholder_id, status, loqed_until')
      .eq('id', s.loq_id)
      .maybeSingle()
    const stale = now - new Date(s.due_at).getTime() > STALE_AFTER_MS
    const cancel = () => supabase.from('loq_surprises').update({ cancelled_at: new Date().toISOString() }).eq('id', s.id).is('executed_at', null)

    if (!loq || ['ended', 'cancelled'].includes(loq.status)) { await cancel(); continue }
    if (loq.status !== 'active' || !loq.loqholder_id || !loq.loqed_until) {
      if (stale) await cancel()
      continue
    }
    if (stale) { await cancel(); continue }

    const next = applySurprise(loq.loqed_until, s.delta_minutes, now, MAX_DURATION_MINUTES)
    if (!next) { await cancel(); continue }

    // Claim it first so an overlapping tick cannot apply it twice.
    const { data: claimed } = await supabase
      .from('loq_surprises')
      .update({ executed_at: new Date().toISOString() })
      .eq('id', s.id)
      .is('executed_at', null)
      .is('cancelled_at', null)
      .select('id')
    if (!claimed?.length) continue

    await supabase.from('loqs').update({ loqed_until: next }).eq('id', loq.id)
    await logAudit(supabase, s.delta_minutes > 0 ? 'loq_time_added' : 'loq_time_removed', loq.loqholder_id, loq.loqee_id, {
      loq_id: loq.id, delta_minutes: s.delta_minutes, reason: 'surprise',
    })

    const { data: settings } = await supabase.from('loq_surprise_settings').select('message').eq('loq_id', loq.id).maybeSingle()
    const text = surpriseText(s.delta_minutes, settings?.message ?? null)
    await supabase.from('messages').insert({
      loq_id: loq.id,
      sender_id: loq.loqholder_id,
      content: `🎁 ${text}`,
      loqee_id: loq.loqee_id,
      loqholder_id: loq.loqholder_id,
    })
    await sendPushNotification(loq.loqee_id, '🎁 A surprise', text, '/dashboard')
    executed++
  }

  const { data: all } = await supabase.from('loq_surprise_settings').select('*').limit(2000)
  for (const settings of all ?? []) {
    const { data: loq } = await supabase.from('loqs').select('status').eq('id', settings.loq_id).maybeSingle()
    if (!loq || !['active', 'paused'].includes(loq.status)) continue

    const { data: last } = await supabase
      .from('loq_surprises')
      .select('due_at')
      .eq('loq_id', settings.loq_id)
      .is('executed_at', null)
      .is('cancelled_at', null)
      .order('due_at', { ascending: false })
      .limit(1)
    const lastMs = last?.[0] ? new Date(last[0].due_at).getTime() : 0
    if (lastMs > now + 24 * 3_600_000) continue

    const plan = planSurprises(settings as SurpriseSettings, Math.max(lastMs, now))
    if (!plan.length) continue
    await supabase.from('loq_surprises').insert(plan.map(p => ({ loq_id: settings.loq_id, ...p })))
    planned += plan.length
  }

  return { executed, planned }
})
