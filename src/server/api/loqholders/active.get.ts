import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { maybeExpireLoq } from '~/server/utils/expireLoq'
import { getVisitorCount } from '~/server/utils/getVisitorCount'
import { loadLockSignals } from '~/server/utils/lockSignals'

export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqholder') throw createError({ statusCode: 403, message: 'Only keyholders can access their active locks' })

  const supabase = useSupabaseAdmin()

  const { data: loqs } = await supabase
    .from('loqs')
    .select(`
      *,
      loqee:profiles!loqee_id(id, display_name, avatar_url, last_seen_at, show_online_status)
    `)
    .eq('loqholder_id', user.id)
    .in('status', ['active', 'paused'])
    .order('accepted_at', { ascending: true })

  const alive = []
  for (const loq of loqs ?? []) {
    if (!await maybeExpireLoq(supabase, loq)) alive.push(loq)
  }

  // Issue #24 — what each card needs to say without loading its modules.
  const signals = await loadLockSignals(supabase, alive)

  const result = await Promise.all(
    alive.map(async (loq) => {
      const loqee = loq.loqee
        ? { ...loq.loqee, last_seen_at: loq.loqee.show_online_status ? loq.loqee.last_seen_at : null, show_online_status: undefined }
        : loq.loqee
      // TASK-090
      const visitor_count = loq.public_link_id ? await getVisitorCount(supabase, loq.id) : 0
      const base = { ...loq, loqee, visitor_count, ...signals.get(loq.id) }
      if (!loq.combination_photo_url) return base
      const { data } = await supabase.storage
        .from('combination-photos')
        .createSignedUrl(loq.combination_photo_url, 3600)
      return { ...base, combination_photo_url: data?.signedUrl ?? null }
    }),
  )

  return result
})
