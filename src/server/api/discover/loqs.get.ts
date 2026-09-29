import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

// TASK-142 — the Discover listing. Signed-in only for now (client may open it
// up later); the individual lock page at /lock/[public_id] stays public either
// way, since that is the link people share outside the app.
//
// Paired loqs are never listed. The client asked for a count of them instead,
// as social proof on the header — so the page shows how much is going on
// without exposing anyone who did not ask to be seen.
export default defineEventHandler(async (event) => {
  const { role } = await requireAuth(event)

  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 20, 100)
  const offset = Number(query.offset) || 0

  const supabase = useSupabaseAdmin()

  const { data, count, error } = await supabase
    .from('loqs')
    .select(`
      id,
      public_link_id,
      loqed_until,
      status,
      emotion,
      reason,
      duration_minutes,
      visitor_add_hours,
      visitor_permission,
      is_public,
      created_at,
      loqee:profiles!loqee_id(id, display_name, avatar_url, username),
      loq_requests(status)
    `, { count: 'exact' })
    .eq('listed_in_discover', true)
    // TASK-145 — a listed loq without a link renders a dead card. The paths
    // that list one all generate it now; this keeps a stray row from a
    // future bug out of the list rather than shipping a 404 to the visitor.
    .not('public_link_id', 'is', null)
    .is('loqholder_id', null)
    .in('status', ['pending', 'active', 'paused'])
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('[discover] Failed to list loqs:', error)
    throw createError({ statusCode: 500, message: 'Failed to load Discover' })
  }

  // Social-proof stat. A count query, not a listing — nothing about a paired
  // loq or the people in it leaves the server.
  const { count: pairedCount } = await supabase
    .from('loqs')
    .select('id', { count: 'exact', head: true })
    .not('loqholder_id', 'is', null)
    .in('status', ['active', 'paused'])

  const shaped = (data ?? []).map((loq) => {
    const { loq_requests, is_public, ...rest } = loq as typeof loq & {
      loq_requests: { status: string }[]
      is_public: boolean
    }
    return {
      ...rest,
      // "Seeking a loqholder" is what is_public has always meant; the name
      // stays in the database, but nothing outside it needs to know that.
      seeking_loqholder: is_public,
      // Only a loqholder can act on this, so only they need to know a
      // request is already pending (TASK-087's reason, carried over).
      has_pending_request: role === 'loqholder'
        ? loq_requests.some(r => r.status === 'pending')
        : false,
    }
  })

  return { data: shaped, total: count ?? 0, paired_count: pairedCount ?? 0 }
})
