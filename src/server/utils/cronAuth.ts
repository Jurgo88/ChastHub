import { timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

// The scheduled Netlify functions knock on the cron routes with the service key.
export function requireCronAuth(event: H3Event) {
  const key = useRuntimeConfig().supabaseServiceKey as string
  const header = getRequestHeader(event, 'authorization')
  if (!header?.startsWith('Bearer ') || !key) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const a = Buffer.from(header.slice(7))
  const b = Buffer.from(key)
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw createError({ statusCode: 401, message: 'Unauthorized' })
}
