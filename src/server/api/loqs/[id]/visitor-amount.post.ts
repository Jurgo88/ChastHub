import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { MAX_DURATION_MINUTES } from '~/server/utils/loqValidation'

const MIN_HOURS = 1 / 60 // 1 minute
const MAX_HOURS = MAX_DURATION_MINUTES / 60 // matches the total-duration ceiling elsewhere (TASK-085)

export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqholder' && role !== 'loqee') {
    throw createError({ statusCode: 403, message: 'Only keyholders or wearers can set the visitor amount' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const body = await readBody<{ hours: number }>(event)
  const hours = body?.hours

  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours < MIN_HOURS || hours > MAX_HOURS) {
    throw createError({ statusCode: 400, message: `hours must be between ${MIN_HOURS} and ${MAX_HOURS}` })
  }

  const supabase = useSupabaseAdmin()

  const { data: loq } = await supabase
    .from('loqs')
    .select('id, loqee_id, loqholder_id, status')
    .eq('id', id)
    .maybeSingle()

  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })

  // Loqholder sets it on a paired loq; the loqee sets it themself on their
  // own self-loq (TASK-059 — "the loqee can set that each vote = 1h or
  // however much they want").
  const isOwningLoqholder = role === 'loqholder' && loq.loqholder_id === user.id
  const isSelfLoqOwner = role === 'loqee' && loq.loqee_id === user.id && loq.loqholder_id === null
  if (!isOwningLoqholder && !isSelfLoqOwner) throw createError({ statusCode: 403, message: 'Not your lock' })

  // TASK-146 — see visitor-permission.post.ts; a listed 'pending' loq needs
  // its owner to be able to set what one vote is worth.
  if (!['pending', 'active', 'paused'].includes(loq.status)) {
    throw createError({ statusCode: 409, message: 'Can only set the visitor amount for an active lock' })
  }

  const { error } = await supabase
    .from('loqs')
    .update({ visitor_add_hours: hours })
    .eq('id', id)

  if (error) throw createError({ statusCode: 500, message: 'Failed to update visitor amount' })

  return { visitor_add_hours: hours }
})
