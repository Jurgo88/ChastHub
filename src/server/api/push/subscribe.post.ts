import { requireAuth } from '~/server/utils/auth'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'

interface PushSubscriptionBody {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)

  const body = await readBody<PushSubscriptionBody>(event)

  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    throw createError({ statusCode: 400, message: 'Invalid push subscription payload' })
  }

  const supabase = useSupabaseAdmin()

  // TASK-097 — keyed on endpoint alone, not (user_id, endpoint): an
  // endpoint belongs to one browser/device, so subscribing always
  // reassigns it to whoever is currently logged in. Otherwise the same
  // device switching between two logged-in accounts (e.g. testing loqee +
  // loqholder) ends up with the endpoint registered to both, and anyone
  // sending that device a push notification also delivers it right back
  // to itself.
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
      { onConflict: 'endpoint' },
    )

  if (error) throw createError({ statusCode: 500, message: 'Failed to save push subscription' })

  return { ok: true }
})
