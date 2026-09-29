import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { getClientIp } from '~/server/utils/clientIp'
import { requireAuth } from '~/server/utils/auth'
import { DELETION_REASON_VALUES } from '~/utils/deletionReasons'

const REPORT_KINDS = ['bug', 'security', 'other']

// Verejný (neautentifikovaný) kanál pre nahlásenie zraniteľností — nálezca
// spravidla nemá účet. Chránený per-IP rate limitom a honeypotom proti botom.
export default defineEventHandler(async (event) => {
  const ip = getClientIp(event) ?? 'unknown'
  if (!await checkRateLimit(`security-report:${ip}`, 5, 60 * 60 * 1000)) {
    throw createError({ statusCode: 429, message: 'Too many submissions. Try again later.' })
  }

  const body = await readBody<{
    message?: string
    contact?: string
    website?: string
    kind?: string
    source?: string
    deletion_reason?: string
    allow_contact?: boolean
  }>(event)

  // Honeypot: skryté pole `website` skutočný používateľ nevyplní, bot áno.
  // Tvárime sa úspešne, aby bot nevedel, že bol odhalený.
  if (body?.website) return { received: true }

  const message = body?.message?.trim()
  let contact = body?.contact?.trim() || null

  if (!message || message.length < 10) {
    throw createError({ statusCode: 400, message: 'Please describe the issue (at least 10 characters).' })
  }
  if (message.length > 5000) {
    throw createError({ statusCode: 400, message: 'Message is too long (max 5000 characters).' })
  }
  if (contact && contact.length > 200) {
    throw createError({ statusCode: 400, message: 'Contact is too long.' })
  }

  // TASK-172 — the form now takes any issue. No kind means an old client of
  // the security-only form, so it is a security report.
  const kind = body?.kind ?? 'security'
  if (!REPORT_KINDS.includes(kind)) {
    throw createError({ statusCode: 400, message: 'Please choose what kind of issue this is.' })
  }

  // TASK-175 — filed from the account-deletion dialog. Only then is the
  // sender identified: the session says who they are (never the body), the
  // reason they are leaving goes with it, and their email is kept only if
  // they agreed, because the account is about to be anonymised. The public
  // form sends no session and stays anonymous, as it promises.
  const source = body?.source ?? 'form'
  let sourceDetail: string | null = null
  let reporterId: string | null = null
  if (source === 'account_deletion') {
    const { user } = await requireAuth(event)
    if (!DELETION_REASON_VALUES.includes(body?.deletion_reason ?? '')) {
      throw createError({ statusCode: 400, message: 'Unknown reason for leaving.' })
    }
    sourceDetail = body!.deletion_reason!
    reporterId = user.id
    contact = body?.allow_contact === true ? (user.email ?? null) : null
  }
  else if (source !== 'form') {
    throw createError({ statusCode: 400, message: 'Unknown report source.' })
  }

  const supabase = useSupabaseAdmin()
  const { error } = await supabase.from('security_reports').insert({
    kind,
    source,
    source_detail: sourceDetail,
    reporter_id: reporterId,
    message,
    contact,
    user_agent: getRequestHeader(event, 'user-agent') ?? null,
    ip,
  })

  if (error) {
    console.error('[security-report] insert failed:', error.message)
    throw createError({ statusCode: 500, message: 'Could not submit. Please try again.' })
  }

  return { received: true }
})
