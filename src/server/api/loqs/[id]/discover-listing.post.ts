import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { generateLinkId } from '~/server/utils/generateLinkId'

// TASK-142 — the owner opts their loq into (or out of) the Discover listing.
// Being listed and accepting time votes are separate decisions: this only
// controls visibility, visitor-permission.post.ts controls the clock.
export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqee') {
    throw createError({ statusCode: 403, message: 'Only wearers can list their own lock' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const body = await readBody<{ listed?: boolean }>(event)
  if (typeof body?.listed !== 'boolean') {
    throw createError({ statusCode: 400, message: 'listed must be true or false' })
  }

  const supabase = useSupabaseAdmin()

  const { data: loq } = await supabase
    .from('loqs')
    .select('id, loqee_id, loqholder_id, status, public_link_id')
    .eq('id', id)
    .maybeSingle<{ id: string; loqee_id: string; loqholder_id: string | null; status: string; public_link_id: string | null }>()

  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  if (loq.loqee_id !== user.id) throw createError({ statusCode: 403, message: 'Not your lock' })

  // A paired loq is never listed — the client's call, and the loqholder
  // would otherwise have strangers moving a clock they control.
  if (loq.loqholder_id) {
    throw createError({ statusCode: 409, message: 'A lock with a keyholder cannot be listed in Discover' })
  }

  if (!['pending', 'active', 'paused'].includes(loq.status)) {
    throw createError({ statusCode: 409, message: 'This lock cannot be listed in its current state' })
  }

  // Only self-loqs get a link at creation, so a queue loq being listed for
  // the first time has none — and the listing card and the adjust-time
  // endpoint are both keyed by it.
  const publicLinkId = loq.public_link_id ?? generateLinkId()

  const { data: updated, error } = await supabase
    .from('loqs')
    .update({ listed_in_discover: body.listed, public_link_id: publicLinkId })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[discover-listing] Failed to update loq:', error)
    throw createError({ statusCode: 500, message: 'Failed to update the listing' })
  }

  return updated
})
