// Scheduled function: opens Lounge sessions (announcement and "Remind me"
// pushes). The work lives in the Nuxt route; this only knocks on it with the
// service key, which is already in the site environment.
export default async () => {
  const base = process.env.URL || 'https://chasthub.com'
  const key = process.env.NUXT_SUPABASE_SERVICE_KEY
  if (!key) return new Response('missing key', { status: 500 })
  const res = await fetch(`${base}/api/cron/lounge-tick`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}` },
  })
  return new Response(await res.text(), { status: res.status })
}

export const config = { schedule: '*/5 * * * *' }
