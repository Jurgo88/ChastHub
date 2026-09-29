import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

// TASK-142 — 'none' means listed and findable, but the clock is untouchable.
// Before this, publishing a loq forced you to let strangers move your time.
const VALID_PERMISSIONS = ['none', 'add', 'remove', 'both'] as const
type VisitorPermission = typeof VALID_PERMISSIONS[number]

// TASK-089 — loqholder (or self-loq owner, mirroring visitor-amount.post.ts's
// permission pattern) decides whether visitors can only add time, only
// remove it, or both.
export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqholder' && role !== 'loqee') {
    throw createError({ statusCode: 403, message: 'Only keyholders or wearers can set visitor permissions' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const body = await readBody<{ permission?: string }>(event)
  const permission = body?.permission as VisitorPermission | undefined

  if (!permission || !VALID_PERMISSIONS.includes(permission)) {
    throw createError({ statusCode: 400, message: `permission must be one of: ${VALID_PERMISSIONS.join(', ')}` })
  }

  const supabase = useSupabaseAdmin()

  const { data: loq } = await supabase
    .from('loqs')
    .select('id, loqee_id, loqholder_id, status')
    .eq('id', id)
    .maybeSingle()

  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })

  const isOwningLoqholder = role === 'loqholder' && loq.loqholder_id === user.id
  const isSelfLoqOwner = role === 'loqee' && loq.loqee_id === user.id && loq.loqholder_id === null
  if (!isOwningLoqholder && !isSelfLoqOwner) throw createError({ statusCode: 403, message: 'Not your lock' })

  // TASK-146 — 'pending' is a running loq (TASK-062) and can be listed in
  // Discover, so its owner has to be able to set this.
  if (!['pending', 'active', 'paused'].includes(loq.status)) {
    throw createError({ statusCode: 409, message: 'Can only set visitor permissions on a running lock' })
  }

  const { error } = await supabase
    .from('loqs')
    .update({ visitor_permission: permission })
    .eq('id', id)

  if (error) throw createError({ statusCode: 500, message: 'Failed to update visitor permission' })

  return { visitor_permission: permission }
})
