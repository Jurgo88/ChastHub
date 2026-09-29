import type { SupabaseClient } from '@supabase/supabase-js'
import { broadcastLoqUpdate } from '~/server/utils/broadcastLoq'
import { sendPushNotification } from '~/server/utils/sendPushNotification'

interface LoqForExpiry {
  id: string
  status: string
  loqee_id: string
  loqholder_id: string | null
  loqed_until: string | null
  paused_at: string | null
}

export async function maybeExpireLoq(supabase: SupabaseClient, loq: LoqForExpiry): Promise<boolean> {
  if (!['active', 'paused', 'draft', 'pending'].includes(loq.status)) return false

  let shouldExpire = false

  if (loq.status === 'active' && loq.loqed_until) {
    shouldExpire = new Date(loq.loqed_until) < new Date()
  }
  else if (loq.status === 'paused' && loq.loqed_until && loq.paused_at) {
    const remaining = new Date(loq.loqed_until).getTime() - new Date(loq.paused_at).getTime()
    shouldExpire = remaining <= 0
  }
  else if (['draft', 'pending'].includes(loq.status) && loq.loqed_until) {
    // Clock starts at creation (TASK-062) — an unattended loq (never accepted
    // by a loqholder) still expires when its window runs out.
    shouldExpire = new Date(loq.loqed_until) < new Date()
  }

  if (!shouldExpire) return false

  const wasUnattended = ['draft', 'pending'].includes(loq.status)
  const now = new Date().toISOString()

  await supabase
    .from('loqs')
    .update({ status: 'ended', locked: false, ended_at: now })
    .eq('id', loq.id)
    .in('status', ['active', 'paused', 'draft', 'pending'])

  if (wasUnattended) {
    // No loqholder ever took control — clear out any requests still pending
    // so they stop showing up in incoming-request lists.
    await supabase
      .from('loq_requests')
      .update({ status: 'auto_rejected', responded_at: now })
      .eq('loq_id', loq.id)
      .eq('status', 'pending')
  }

  // Drive-by fix: same Netlify-Lambda-freeze issue TASK-083 fixed for
  // sendPushNotification below — void'd here could get frozen mid-flight.
  await broadcastLoqUpdate(loq.id, { loq: { id: loq.id, status: 'ended', locked: false, ended_at: now } })

  // TASK-148 — /loqs/<id> is not a route; /dashboard redirects by role.
  const pushUrl = '/dashboard'
  const message = wasUnattended ? 'Your lock expired without being accepted.' : 'Your lock session has expired.'
  await sendPushNotification(loq.loqee_id, 'Lock ended', message, pushUrl)
  if (loq.loqholder_id) {
    await sendPushNotification(loq.loqholder_id, 'Lock ended', 'The lock session has expired.', pushUrl)
  }

  return true
}
