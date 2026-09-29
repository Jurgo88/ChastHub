import type { Profile } from '~/types'
import type { Session } from '@supabase/supabase-js'
import { reclaimPushSubscription } from '~/composables/usePushNotifications'

export default defineNuxtPlugin(async () => {
  const { $supabase } = useNuxtApp()
  const authStore = useAuthStore()
  const presence = useOnlinePresence()

  // Keep store in sync with Supabase auth state
  $supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      $supabase.realtime.setAuth(session.access_token)
      authStore.setSession(session)
      // TASK-082 — mirror the refresh token into an httpOnly cookie so a
      // wiped/isolated localStorage (in-app browsers, Private Browsing)
      // doesn't force a full re-login next time. Fire-and-forget is safe
      // here — this runs in the browser, not a serverless function, so
      // there's no Lambda-freeze risk like TASK-083's server-side bug.
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        void $fetch('/api/auth/session-cookie', {
          method: 'POST',
          body: { refresh_token: session.refresh_token },
        })
      }
    }
    else if (event === 'SIGNED_OUT') {
      $supabase.realtime.setAuth(null)
      authStore.clear()
      presence.stop()
    }
  })

  // Restore session from localStorage on app load
  let { data: { session } } = await $supabase.auth.getSession()

  // TASK-082 — localStorage had nothing (wiped, isolated in-app-browser
  // storage, or Private Browsing). Before treating this as a logged-out
  // visitor, try recovering via the httpOnly refresh-token cookie.
  if (!session) {
    try {
      const recovered = await $fetch<{ session: Session; user: unknown } | null>('/api/auth/refresh', {
        method: 'POST',
      })
      if (recovered?.session) {
        const { error } = await $supabase.auth.setSession({
          access_token: recovered.session.access_token,
          refresh_token: recovered.session.refresh_token,
        })
        if (!error) {
          ({ data: { session } } = await $supabase.auth.getSession())
        }
      }
    }
    catch {
      // No valid cookie, or the refresh token was rejected — proceed as
      // logged out, same as before this fallback existed.
    }
  }

  if (!session) return // Stop here if no session - this is OK for public pages!

  const { data: { user } } = await $supabase.auth.getUser()
  if (!user) {
    authStore.clear()
    return
  }

  // Explicitly authenticate the Realtime connection with the user's JWT.
  // Without this, channels created in onMounted may run under the anon key,
  // causing auth.uid() to be NULL in RLS checks and all events to be dropped.
  $supabase.realtime.setAuth(session.access_token)

  authStore.setSession(session)

  try {
    const { data: profile } = await $supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single<Profile>()

    if (profile) authStore.setProfile(profile)
  }
  catch (e) {
    console.error('Failed to fetch profile:', e)
    // Continue anyway - not critical
  }

  // TASK-101 — was only run from NotificationPermission.vue, which only
  // lives on /profile. A user who never visits that page after switching
  // accounts on a device never re-claims it, so a stale push subscription
  // from the previous account on this device keeps receiving their
  // notifications indefinitely. Runs on every authenticated boot instead.
  void reclaimPushSubscription()

  presence.start()
})
