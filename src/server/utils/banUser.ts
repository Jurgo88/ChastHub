import type { SupabaseClient } from '@supabase/supabase-js'

export async function banUser(
  supabase: SupabaseClient,
  adminId: string,
  targetId: string,
  details: { reason?: string | null; report_id?: string | null } = {},
): Promise<{ loqsTerminated: number }> {
  const now = new Date().toISOString()

  await supabase.from('profiles').update({ status: 'banned' }).eq('id', targetId)

  const { data: loqeeLoqs } = await supabase
    .from('loqs')
    .update({ status: 'ended', locked: false, ended_at: now, paused_at: null })
    .eq('loqee_id', targetId)
    .in('status', ['draft', 'pending', 'active', 'paused'])
    .select('id')

  const { data: loqholderLoqs } = await supabase
    .from('loqs')
    .update({ status: 'ended', locked: false, ended_at: now, paused_at: null })
    .eq('loqholder_id', targetId)
    .in('status', ['active', 'paused'])
    .select('id')

  await supabase
    .from('loq_requests')
    .update({ status: 'cancelled', responded_at: now })
    .eq('loqholder_id', targetId)
    .eq('status', 'pending')

  const terminatedLoqIds = (loqeeLoqs ?? []).map(l => l.id)
  if (terminatedLoqIds.length > 0) {
    await supabase
      .from('loq_requests')
      .update({ status: 'cancelled', responded_at: now })
      .in('loq_id', terminatedLoqIds)
      .eq('status', 'pending')
  }

  const loqsTerminated = (loqeeLoqs?.length ?? 0) + (loqholderLoqs?.length ?? 0)

  await supabase.from('audit_log').insert({
    action: 'user_banned',
    actor_id: adminId,
    target_id: targetId,
    details: { reason: details.reason ?? null, report_id: details.report_id ?? null, loqs_terminated: loqsTerminated },
  })

  return { loqsTerminated }
}
