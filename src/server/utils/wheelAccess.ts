import type { SupabaseClient } from '@supabase/supabase-js'

export type WheelRole = 'wearer' | 'keyholder'

export interface WheelLock {
  id: string
  loqee_id: string
  loqholder_id: string | null
  status: string
  loqed_until: string | null
  frozen_until: string | null
}

/**
 * Loads the lock and says what the caller is on it. Throws 404 for an unknown
 * lock and 403 for someone who is not on it. A self-lock wearer is "wearer"
 * here; `selfLock` tells the caller they also own the settings.
 */
export async function loadWheelLock(supabase: SupabaseClient, loqId: string, userId: string) {
  const { data: loq } = await supabase
    .from('loqs')
    .select('id, loqee_id, loqholder_id, status, loqed_until, frozen_until')
    .eq('id', loqId)
    .maybeSingle<WheelLock>()
  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })

  const role: WheelRole | null = loq.loqee_id === userId ? 'wearer' : loq.loqholder_id === userId ? 'keyholder' : null
  if (!role) throw createError({ statusCode: 403, message: 'Access denied' })

  return { loq, role, selfLock: loq.loqholder_id === null }
}
