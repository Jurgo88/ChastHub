export function useAuthFetch() {
  const { $supabase } = useNuxtApp()

  async function authFetch<T>(url: string, options: Parameters<typeof $fetch>[1] = {}): Promise<T> {
    const { data: { session } } = await $supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    return $fetch<T>(url, {
      ...options,
      headers: {
        ...(options?.headers as Record<string, string> | undefined),
        Authorization: `Bearer ${session.access_token}`,
      },
    })
  }

  return { authFetch }
}
