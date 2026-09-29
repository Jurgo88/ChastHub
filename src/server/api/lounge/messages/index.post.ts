import { requireAuth } from '~/server/utils/auth'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { LOUNGE_MAX_LENGTH, getLoungeSettings, getLoungeStatus, pingLounge } from '~/server/utils/lounge'
import { LOUNGE_MESSAGE_COLUMNS, shapeLoungeMessages } from '~/server/utils/loungeMessages'
import { getLoungeMe } from '~/server/utils/loungeMe'
import { containsLink } from '~/utils/loungeSchedule'

export default defineEventHandler(async (event) => {
  const { user, adminLevel } = await requireAuth(event)
  const body = await readBody<{ content?: string; reply_to?: string; question_day?: number }>(event)
  const content = (body?.content ?? '').replace(/\s+\n/g, '\n').trim()

  if (!content) throw createError({ statusCode: 400, message: 'Write something first.' })
  if (content.length > LOUNGE_MAX_LENGTH) throw createError({ statusCode: 400, message: `Keep it under ${LOUNGE_MAX_LENGTH} characters.` })
  if (containsLink(content)) throw createError({ statusCode: 400, message: 'Links are not allowed in the Lounge.' })

  const settings = await getLoungeSettings()
  const status = await getLoungeStatus(Date.now(), settings)
  const me = await getLoungeMe(user.id, adminLevel, status, settings)
  if (!me.can_post) throw createError({ statusCode: 403, message: me.blocked_reason ?? 'You can not write here right now.' })

  // Slow mode, moderators excepted.
  if (!me.moderator && me.last_post_at && settings.slow_mode_seconds > 0) {
    const wait = settings.slow_mode_seconds * 1000 - (Date.now() - new Date(me.last_post_at).getTime())
    if (wait > 0) {
      setResponseHeader(event, 'Retry-After', Math.ceil(wait / 1000))
      throw createError({ statusCode: 429, message: `Slow mode. Wait ${Math.ceil(wait / 1000)}s.` })
    }
  }
  if (!await checkRateLimit(`lounge:${user.id}`, 60, 3_600_000)) {
    throw createError({ statusCode: 429, message: 'That is a lot of messages. Take a short break.' })
  }

  const supabase = useSupabaseAdmin()

  let replyTo: string | null = null
  if (body?.reply_to && typeof body.reply_to === 'string') {
    const { data } = await supabase.from('lounge_messages').select('id').eq('id', body.reply_to).is('deleted_at', null).maybeSingle()
    replyTo = data?.id ?? null
  }
  const questionDay = status.question && body?.question_day === status.question.day ? status.question.day : null

  const { data: row, error } = await supabase
    .from('lounge_messages')
    .insert({ kind: 'user', user_id: user.id, content, reply_to: replyTo, question_day: questionDay })
    .select(LOUNGE_MESSAGE_COLUMNS)
    .single()
  if (error || !row) throw createError({ statusCode: 500, message: 'Could not send. Try again.' })

  await pingLounge()
  const [message] = await shapeLoungeMessages([row])
  return message
})
