import { createClient } from '@supabase/supabase-js'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const supabase = createClient(
    config.public.supabaseUrl,
    config.public.supabaseAnonKey,
    {
      // Explicit rather than relying on SDK defaults (TASK-082) — this is
      // the primary session store; localStorage.setItem is a no-op in some
      // WebViews/in-app browsers instead of throwing, so a missing/broken
      // storage adapter here would fail silently rather than loudly.
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    },
  )

  return {
    provide: {
      supabase,
    },
  }
})
