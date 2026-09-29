import type { SupabaseClient } from '@supabase/supabase-js'

export async function logAudit(
  supabase: SupabaseClient,
  action: string,
  actorId: string,
  targetId: string,
  details: Record<string, unknown> = {},
) {
  const { error } = await supabase.from('audit_log').insert({ action, actor_id: actorId, target_id: targetId, details })
  // Audit logging must never break the action it's logging — swallow the
  // error, but surface it so a permissions/schema issue like this one
  // (missing service_role grant, only caught by accident via a different
  // table's error handling) doesn't go silently unnoticed again.
  if (error) console.error('[auditLog] insert failed:', error)
}
