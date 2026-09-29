import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth, requireActiveSubscription } from '~/server/utils/auth'
import { generateLinkId } from '~/server/utils/generateLinkId'

export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqee') throw createError({ statusCode: 403, message: 'Only wearers can publish locks' })

  await requireActiveSubscription(user.id, 'Active subscription required to publish a lock')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const supabase = useSupabaseAdmin()

  const { data: loq } = await supabase
    .from('loqs')
    .select('id, loqee_id, status, public_link_id')
    .eq('id', id)
    .maybeSingle<{ id: string; loqee_id: string; status: string; public_link_id: string | null }>()

  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  if (loq.loqee_id !== user.id) throw createError({ statusCode: 403, message: 'Not your lock' })
  if (!['draft', 'pending'].includes(loq.status)) {
    throw createError({ statusCode: 409, message: 'Cannot publish a lock in this state' })
  }

  // TASK-145 — only self-loqs get a link at creation (api/loqs/index.post.ts),
  // and everything about a listed loq is keyed by it: the Discover card links
  // to /loq/<public_link_id> and the vote posts to
  // /api/loq/<public_link_id>/adjust-time. Publishing without one produced a
  // card pointing at /loq/null, and pressing add answered "Loq not found".
  const publicLinkId = loq.public_link_id ?? generateLinkId()

  const { data: updated, error } = await supabase
    .from('loqs')
    .update({
      is_public: true,
      listed_in_discover: true,
      status: 'pending',
      public_link_id: publicLinkId,
      // TASK-186 — when it started looking for a loqholder. Only on the first
      // step out of draft: re-publishing a pending loq must not reset the wait.
      ...(loq.status === 'draft' ? { published_at: new Date().toISOString() } : {}),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: 'Failed to publish lock' })

  return updated
})
