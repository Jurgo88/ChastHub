import { requireAuth } from '~/server/utils/auth'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { getLoungeSettings, getLoungeStatus } from '~/server/utils/lounge'
import { LOUNGE_MESSAGE_COLUMNS, shapeLoungeMessages } from '~/server/utils/loungeMessages'
import { getLoungeMe } from '~/server/utils/loungeMe'

const PAGE = 80

// The newest messages (or only those after ?after=<iso>), the caller's
// permissions and the number of answers to today's question.
export default defineEventHandler(async (event) => {
  const { user, adminLevel } = await requireAuth(event)
  const supabase = useSupabaseAdmin()
  const q = getQuery(event)
  const after = typeof q.after === 'string' && !Number.isNaN(Date.parse(q.after)) ? q.after : null
  const before = typeof q.before === 'string' && !Number.isNaN(Date.parse(q.before)) ? q.before : null

  const settings = await getLoungeSettings()
  const status = await getLoungeStatus(Date.now(), settings)

  let query = supabase
    .from('lounge_messages')
    .select(LOUNGE_MESSAGE_COLUMNS)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(PAGE)
  if (after) query = query.gt('created_at', after)
  if (before) query = query.lt('created_at', before)

  const [{ data, error }, me] = await Promise.all([query, getLoungeMe(user.id, adminLevel, status, settings)])
  if (error) throw createError({ statusCode: 500, message: 'Failed to load the Lounge' })

  const rows = (data ?? []).reverse()
  const messages = await shapeLoungeMessages(rows)

  let answers = 0
  if (status.question) {
    const { count } = await supabase
      .from('lounge_messages')
      .select('id', { count: 'exact', head: true })
      .eq('question_day', status.question.day)
      .is('deleted_at', null)
      .gte('created_at', new Date(Date.now() - 2 * 86_400_000).toISOString())
    answers = count ?? 0
  }

  return { messages, has_more: !after && rows.length === PAGE, me, answers }
})
