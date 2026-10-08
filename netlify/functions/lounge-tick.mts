// Scheduled function: opens Lounge sessions (announcement and "Remind me"
// pushes), runs the daily check-in reminders and penalties, announces lock
// milestones, executes the keyholder's scheduled surprises and settles
// challenge entries and verification photo requests. The work lives
// in the Nuxt routes; this only knocks on them with the service key, which is
// already in the site environment.
const ROUTES = ['lounge-tick', 'checkin-tick', 'milestone-tick', 'surprise-tick', 'challenge-tick', 'verification-tick']

export default async () => {
  const base = process.env.URL || 'https://chasthub.com'
  const key = process.env.NUXT_SUPABASE_SERVICE_KEY
  if (!key) return new Response('missing key', { status: 500 })

  const results = await Promise.all(ROUTES.map(async (name) => {
    const res = await fetch(`${base}/api/cron/${name}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
    })
    return { name, ok: res.ok, body: await res.text() }
  }))

  return new Response(results.map(r => `${r.name}: ${r.body}`).join('\n'), {
    status: results.every(r => r.ok) ? 200 : 500,
  })
}

export const config = { schedule: '*/5 * * * *' }
