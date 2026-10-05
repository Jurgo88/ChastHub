import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth, requireActiveSubscription } from '~/server/utils/auth'
import { isValidDuration, isValidEmotion, computeLoqedUntil, MAX_DURATION_MINUTES } from '~/server/utils/loqValidation'
import { generateLinkId } from '~/server/utils/generateLinkId'

export default defineEventHandler(async (event) => {
  const { user, role } = await requireAuth(event)
  if (role !== 'loqee') throw createError({ statusCode: 403, message: 'Only wearers can create locks' })

  const body = await readBody<{
    duration_minutes: number
    combination_text?: string
    combination_photo_url?: string
    emotion?: string
    reason?: string
    self?: boolean
    visitor_permission?: string
    visitor_add_hours?: number
    listed_in_discover?: boolean
  }>(event)

  const { duration_minutes, combination_text, combination_photo_url, emotion, reason, self } = body ?? {}

  // Visitor settings can be chosen up front, but only for a self-lock: on a
  // paired lock they belong to the keyholder.
  const extra: Record<string, unknown> = {}
  if (self) {
    const { visitor_permission: perm, visitor_add_hours: hrs, listed_in_discover: listed } = body ?? {}
    if (perm !== undefined) {
      if (!['none', 'add', 'remove', 'both'].includes(perm)) throw createError({ statusCode: 400, message: 'Invalid visitor_permission' })
      extra.visitor_permission = perm
    }
    if (hrs !== undefined) {
      if (typeof hrs !== 'number' || !Number.isFinite(hrs) || hrs < 1 / 60 || hrs > MAX_DURATION_MINUTES / 60) {
        throw createError({ statusCode: 400, message: 'Invalid visitor_add_hours' })
      }
      extra.visitor_add_hours = hrs
    }
    if (listed !== undefined) {
      if (typeof listed !== 'boolean') throw createError({ statusCode: 400, message: 'listed_in_discover must be true or false' })
      extra.listed_in_discover = listed
    }
  }

  if (!duration_minutes || typeof duration_minutes !== 'number') {
    throw createError({ statusCode: 400, message: 'duration_minutes is required' })
  }
  if (!isValidDuration(duration_minutes)) {
    throw createError({ statusCode: 400, message: `Duration must be between 1 minute and ${Math.floor(MAX_DURATION_MINUTES / 1440)} days` })
  }
  if (!combination_text?.trim() && !combination_photo_url?.trim()) {
    throw createError({ statusCode: 400, message: 'Either combination_text or combination_photo_url is required' })
  }
  if (emotion && !isValidEmotion(emotion)) {
    throw createError({ statusCode: 400, message: 'Invalid emotion' })
  }

  await requireActiveSubscription(user.id, 'Active subscription required to create a lock')

  const supabase = useSupabaseAdmin()

  const { data: existing } = await supabase
    .from('loqs')
    .select('id, status')
    .eq('loqee_id', user.id)
    .in('status', ['draft', 'pending', 'active', 'paused'])
    .maybeSingle()

  if (existing) {
    throw createError({ statusCode: 409, message: 'You already have an active lock. Cancel it before creating a new one.' })
  }

  // Clock starts at creation (TASK-062), not at loqholder acceptance —
  // acceptance still gates who has control, but never recomputes this.
  const loqedUntil = computeLoqedUntil(new Date(), duration_minutes)

  // Self-loq (TASK-058): no loqholder is ever expected, so there's nothing
  // to wait for — skip 'draft'/'pending' and go straight to 'active', and
  // generate the visitor share link up front (paired loqs only get one once
  // a loqholder chooses to share it, TASK-063 — a self-loq has no loqholder
  // to gate that decision).
  const { data: loq, error } = await supabase
    .from('loqs')
    .insert({
      loqee_id: user.id,
      duration_minutes,
      combination_text: combination_text ?? null,
      combination_photo_url: combination_photo_url ?? null,
      emotion: emotion ?? null,
      reason: reason ?? null,
      status: self ? 'active' : 'draft',
      // A self-lock is locked from the start; paired locks flip this on accept.
      locked: !!self,
      loqed_until: loqedUntil,
      public_link_id: self ? generateLinkId() : null,
      ...extra,
    })
    .select()
    .single()

  if (error) {
    console.error('[locks] Failed to create loq:', error)
    throw createError({ statusCode: 500, message: 'Failed to create lock' })
  }

  return loq
})
