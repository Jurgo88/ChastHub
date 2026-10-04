import { createHash } from 'crypto'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { getClientIp } from '~/server/utils/clientIp'
import { REACTIONS, type ReactionKey } from '~/server/utils/publicLoqActivity'

// POST /api/loq/<public_id>/react { emoji }: one tap reaction on a public
// lock. Each visitor (account, or IP hash when signed out) can send each
// reaction once an hour per lock.
export default defineEventHandler(async (event) => {
  const publicId = getRouterParam(event, 'public_id')
  const body = await readBody<{ emoji?: string }>(event)
  const emoji = body?.emoji as ReactionKey | undefined
  if (!publicId) throw createError({ statusCode: 400, message: 'Missing public_id' })
  if (!emoji || !(REACTIONS as readonly string[]).includes(emoji)) throw createError({ statusCode: 400, message: 'Unknown reaction' })

  const supabase = useSupabaseAdmin()
  const { data: loq } = await supabase
    .from('loqs')
    .select('id, status')
    .eq('public_link_id', publicId)
    .maybeSingle()
  if (!loq) throw createError({ statusCode: 404, message: 'Lock not found' })
  if (!['active', 'paused'].includes(loq.status)) throw createError({ statusCode: 410, message: 'This lock has ended' })

  let userId: string | null = null
  const authHeader = getRequestHeader(event, 'authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7))
    userId = user?.id ?? null
  }
  const ip = getClientIp(event)
  const ipHash = ip ? createHash('sha256').update(ip).digest('hex').slice(0, 32) : null
  const who = userId ?? ipHash
  if (!who) throw createError({ statusCode: 400, message: 'Could not identify you' })

  if (!await checkRateLimit(`react:${loq.id}:${who}:${emoji}`, 1, 3_600_000)) {
    throw createError({ statusCode: 429, message: 'You already sent that one. Try again in an hour.' })
  }

  const { error } = await supabase.from('loq_reactions').insert({ loq_id: loq.id, emoji, ip_hash: ipHash, user_id: userId })
  if (error) throw createError({ statusCode: 503, message: 'Reactions are not available right now' })

  const { count } = await supabase
    .from('loq_reactions')
    .select('id', { count: 'exact', head: true })
    .eq('loq_id', loq.id)
    .eq('emoji', emoji)

  return { emoji, count: count ?? 0 }
})
