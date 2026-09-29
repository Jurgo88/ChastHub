// TASK-185 — each Insights section loads its own endpoint, so one slow or
// failing section never blanks the others.
export function useInsight<T>(url: string) {
  const { authFetch } = useAuthFetch()
  const data = ref<T | null>(null) as Ref<T | null>
  const loading = ref(true)
  const error = ref('')

  onMounted(async () => {
    try {
      data.value = await authFetch<T>(url)
    }
    catch (e: any) {
      error.value = e?.data?.message || e?.message || 'Failed to load.'
    }
    finally {
      loading.value = false
    }
  })

  return { data, loading, error }
}

/** "12 · 34%" helpers shared by the sections. */
export function pctOf(n: number, of: number): string {
  return of ? `${Math.round((n / of) * 100)}%` : '–'
}
