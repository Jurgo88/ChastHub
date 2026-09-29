import type { SupabaseClient } from '@supabase/supabase-js'

// TASK-090 — distinct visitors (by ip_hash) who've interacted with a loq's
// share link, not raw interaction count (one visitor adding time 3 times
// shouldn't read as "3 visitors").
export async function getVisitorCount(supabase: SupabaseClient, loqId: string): Promise<number> {
  const { data } = await supabase
    .from('loq_visitor_interactions')
    .select('ip_hash')
    .eq('loq_id', loqId)

  if (!data) return 0
  return new Set(data.map(row => row.ip_hash)).size
}
