import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { checkRateLimit } from '~/server/utils/rateLimit'

const VALID_REASONS = ['Abusive behavior', 'Harassment', 'Inappropriate content', 'Other']

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)

  if (!await checkRateLimit(`reports:${user.id}`, 5, 3_600_000)) {
    throw createError({ statusCode: 429, message: 'Too many reports. Try again later.' })
  }

  const supabase = useSupabaseAdmin()

  const body = await readBody<{ reported_user_id: string; reason: string; description?: string; conversation_id?: string }>(event)
  const { reported_user_id, reason, description, conversation_id } = body ?? {}

  if (!reported_user_id || !reason) {
    throw createError({ statusCode: 400, message: 'reported_user_id and reason are required' })
  }

  if (!VALID_REASONS.includes(reason)) {
    throw createError({ statusCode: 400, message: 'Invalid reason' })
  }

  if (reported_user_id === user.id) {
    throw createError({ statusCode: 400, message: 'Cannot report yourself' })
  }

  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', reported_user_id)
    .maybeSingle()

  if (!targetProfile) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  // If a conversation is attached, verify the reporter is actually a
  // participant — otherwise anyone could tag an arbitrary conversation
  // onto their report and give admins something misleading to review.
  let verifiedConversationId: string | null = null
  if (conversation_id) {
    const { data: convo } = await supabase
      .from('conversations')
      .select('id, user_a_id, user_b_id')
      .eq('id', conversation_id)
      .maybeSingle()

    if (convo && (convo.user_a_id === user.id || convo.user_b_id === user.id)) {
      verifiedConversationId = convo.id
    }
  }

  const { data: report, error } = await supabase
    .from('reports')
    .insert({
      reported_user_id,
      reported_by_id: user.id,
      reason,
      description: description ?? null,
      conversation_id: verifiedConversationId,
    })
    .select('id, created_at')
    .single()

  if (error) {
    throw createError({ statusCode: 500, message: 'Failed to submit report' })
  }

  return { id: report.id, created_at: report.created_at }
})
