import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqee') throw createError({ statusCode: 403, message: 'Only wearers can browse keyholders' })

  const query = getQuery(event)
  const q = String(query.q ?? '').trim()
  const loqId = String(query.loq_id ?? '').trim() || null
  const page = Math.max(1, parseInt(String(query.page ?? '1')))
  const limit = Math.min(50, Math.max(1, parseInt(String(query.limit ?? '20'))))
  const offset = (page - 1) * limit

  const supabase = useSupabaseAdmin()

  // Verify the loq belongs to the requesting user (if loq_id provided)
  if (loqId) {
    const { data: loq } = await supabase
      .from('loqs')
      .select('loqee_id')
      .eq('id', loqId)
      .maybeSingle()
    if (loq && loq.loqee_id !== user.id) {
      throw createError({ statusCode: 403, message: 'Not your lock' })
    }
  }

  let profilesQuery = supabase
    .from('profiles')
    .select('id, display_name, avatar_url, bio', { count: 'exact' })
    .eq('role', 'loqholder')
    .eq('status', 'active')
    .order('display_name', { ascending: true })
    .range(offset, offset + limit - 1)

  if (q) {
    profilesQuery = profilesQuery.ilike('display_name', `%${q}%`)
  }

  const { data: profiles, count, error } = await profilesQuery

  if (error) throw createError({ statusCode: 500, message: 'Failed to fetch keyholders' })

  // For each loqholder, count their currently active loqs
  const ids = (profiles ?? []).map(p => p.id)

  const { data: activeCounts } = ids.length
    ? await supabase
        .from('loqs')
        .select('loqholder_id')
        .in('loqholder_id', ids)
        .in('status', ['active', 'paused'])
    : { data: [] }

  const countMap = new Map<string, number>()
  for (const row of activeCounts ?? []) {
    countMap.set(row.loqholder_id, (countMap.get(row.loqholder_id) ?? 0) + 1)
  }

  // Fetch already-pending requests for this loq
  const requestedIds = new Set<string>()
  if (loqId && ids.length) {
    const { data: existing } = await supabase
      .from('loq_requests')
      .select('loqholder_id')
      .eq('loq_id', loqId)
      .eq('status', 'pending')
      .in('loqholder_id', ids)

    for (const r of existing ?? []) requestedIds.add(r.loqholder_id)
  }

  const data = (profiles ?? []).map(p => ({
    id: p.id,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    bio: p.bio,
    active_loqs_count: countMap.get(p.id) ?? 0,
    requested: requestedIds.has(p.id),
  }))

  return { data, total: count ?? 0, page, limit }
})
