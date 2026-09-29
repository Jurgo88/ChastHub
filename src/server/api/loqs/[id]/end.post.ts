import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { logAudit } from '~/server/utils/auditLog'

export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqholder' && role !== 'loqee') {
    throw createError({ statusCode: 403, message: 'Only keyholders or wearers can end a lock' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Lock ID required' })

  const supabase = useSupabaseAdmin()

  const { data: loq } = await supabase
    .from('loqs')
    .select('id, loqee_id, loqholder_id, status')
    .eq('id', id)
    .maybeSingle()

  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })

  // Self-loq (no loqholder) is self-service by its owner — see pause.post.ts.
  const isOwningLoqholder = role === 'loqholder' && loq.loqholder_id === user.id
  const isSelfLoqOwner = role === 'loqee' && loq.loqee_id === user.id && loq.loqholder_id === null
  if (!isOwningLoqholder && !isSelfLoqOwner) throw createError({ statusCode: 403, message: 'Not your lock' })

  if (!['active', 'paused'].includes(loq.status)) {
    throw createError({ statusCode: 409, message: 'Lock is not active or paused' })
  }

  const { data: updated, error } = await supabase
    .from('loqs')
    .update({ status: 'ended', locked: false, ended_at: new Date().toISOString(), paused_at: null })
    .eq('id', id)
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: 'Failed to end lock' })

  await logAudit(supabase, 'loq_ended', user.id, loq.loqee_id, { loq_id: id })

  return updated
})
