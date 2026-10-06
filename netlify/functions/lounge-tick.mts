// Scheduled function: opens Lounge sessions (announcement and "Remind me"
// pushes) and runs the daily check-in reminders and penalties. The work lives
// in the Nuxt routes; this only knocks on them with the service key, which is
// already in the site environment.
export default async () => {
  const base = process.env.URL || 'https://chasthub.com'
  const key = process.env.NUXT_SUPABASE_SERVICE_KEY
  if (!key) return new Response('missing key', { status: 500 })
  const call = (path: string) => fetch(`${base}/api/cron/${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}` },
  })
  const [lounge, checkin] = await Promise.all([call('lounge-tick'), call('checkin-tick')])
  const status = lounge.ok && checkin.ok ? 200 : 500
  return new Response(`lounge: ${await lounge.text()}\ncheckin: ${await checkin.text()}`, { status })
}

export const config = { schedule: '*/5 * * * *' }
