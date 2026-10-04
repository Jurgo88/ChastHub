import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { lockOgSvg, type LockOgData } from '~/server/utils/lockOgImage'
import { renderSvgToPng } from '~/server/utils/ogRender'

// GET /api/og/lock/<public_id>: live share image for a public lock. The page
// points og:image here with a 10-minute ?v= bucket, so previews stay fresh
// without rendering on every crawler hit.
export default defineEventHandler(async (event) => {
  const publicId = getRouterParam(event, 'public_id')
  if (!publicId || !/^[A-Za-z0-9_-]{4,64}$/.test(publicId)) throw createError({ statusCode: 404, message: 'Not found' })

  const supabase = useSupabaseAdmin()
  const { data: loq } = await supabase
    .from('loqs')
    .select('id, created_at, loqed_until, paused_at, status, visitor_permission')
    .eq('public_link_id', publicId)
    .maybeSingle()
  if (!loq) throw createError({ statusCode: 404, message: 'Not found' })

  const { data: rows } = await supabase
    .from('loq_visitor_interactions')
    .select('ip_hash, user_id, hours_added, direction')
    .eq('loq_id', loq.id)
    .limit(5000)

  const visitors = new Set((rows ?? []).map(r => r.user_id ?? r.ip_hash)).size
  const addedHours = (rows ?? []).filter(r => r.direction === 'add').reduce((s, r) => s + Number(r.hours_added), 0)

  const now = Date.now()
  const until = loq.loqed_until ? new Date(loq.loqed_until).getTime() : now
  const start = new Date(loq.created_at).getTime()
  const clock = loq.paused_at ? new Date(loq.paused_at).getTime() : now
  const ended = ['ended', 'cancelled'].includes(loq.status) || until <= clock

  const data: LockOgData = {
    state: ended ? 'ended' : loq.status === 'paused' ? 'paused' : 'locked',
    leftMs: Math.max(0, until - clock),
    progress: until > start ? (clock - start) / (until - start) : 1,
    visitors,
    addedHours,
    permission: (loq.visitor_permission === 'none' ? 'add' : loq.visitor_permission) as LockOgData['permission'],
  }

  const png = await renderSvgToPng(lockOgSvg(data))
  setResponseHeader(event, 'Content-Type', 'image/png')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=300')
  setResponseHeader(event, 'Netlify-CDN-Cache-Control', 'public, s-maxage=600, stale-while-revalidate=600')
  return png
})
