import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'

export async function checkRateLimit(key: string, maxAttempts: number, windowMs: number): Promise<boolean> {
  const supabase = useSupabaseAdmin()

  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_key: key,
    p_max: maxAttempts,
    p_window_ms: windowMs,
  })

  if (error) {
    console.error('[rateLimit] check_rate_limit rpc error:', error)
    return true
  }

  void supabase
    .from('rate_limit_buckets')
    .delete()
    .lt('reset_at', new Date().toISOString())
    .then(() => {})

  return data as boolean
}
