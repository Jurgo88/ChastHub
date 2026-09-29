import webpush from 'web-push'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  url: string,
): Promise<void> {
  const config = useRuntimeConfig()

  const vapidPublicKey = config.public.vapidPublicKey as string
  const vapidPrivateKey = config.vapidPrivateKey as string
  const vapidEmail = config.vapidEmail as string

  if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) return

  const supabase = useSupabaseAdmin()

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs?.length) return

  const subject = vapidEmail.startsWith('mailto:') ? vapidEmail : `mailto:${vapidEmail}`
  webpush.setVapidDetails(subject, vapidPublicKey, vapidPrivateKey)

  const payload = JSON.stringify({ title, body, url })

  await Promise.allSettled(
    subs.map(sub =>
      webpush
        .sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
        .catch(async (err: { statusCode?: number; body?: string; message?: string }) => {
          // Subscription expired or invalid — remove it so we stop trying
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
            return
          }
          // TASK-100 — any other failure (bad VAPID, payload too large,
          // rate limited, network) was silently swallowed here, making
          // "it doesn't arrive on this one device" undiagnosable without
          // digging through raw DB rows. Log enough to tell them apart.
          console.error(
            '[push] Send failed:', sub.endpoint.slice(0, 60) + '…',
            'statusCode:', err.statusCode, 'body:', err.body ?? err.message,
          )
        }),
    ),
  )
}
