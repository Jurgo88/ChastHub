export interface LeaderboardLoqholder {
  rank: number
  id: string
  display_name: string
  avatar_url: string | null
  controlled_loqs: number
  username: string | null
}

export interface LeaderboardLoqee {
  rank: number
  id: string
  display_name: string
  avatar_url: string | null
  longest_loq_hours: number
  username: string | null
}

export function useLeaderboard() {
  const loqholders = ref<LeaderboardLoqholder[]>([])
  const loqees = ref<LeaderboardLoqee[]>([])
  const loading = ref(false)
  const error = ref('')

  // Own rank — only populated for an authenticated user, only when they
  // actually appear in the (unbounded) ranked view. Null means "not on the
  // board" (opted out, no ended loqs yet, etc.), not an error.
  const ownLoqholderRank = ref<LeaderboardLoqholder | null>(null)
  const ownLoqeeRank = ref<LeaderboardLoqee | null>(null)

  async function fetchLoqholders(limit = 50) {
    loading.value = true
    error.value = ''
    try {
      const data = await $fetch<LeaderboardLoqholder[]>(`/api/leaderboard/loqholders?limit=${limit}`)
      loqholders.value = data
    }
    catch {
      error.value = 'Failed to load leaderboard.'
    }
    finally {
      loading.value = false
    }
  }

  async function fetchLoqees(limit = 50) {
    loading.value = true
    error.value = ''
    try {
      const data = await $fetch<LeaderboardLoqee[]>(`/api/leaderboard/loqees?limit=${limit}`)
      loqees.value = data
    }
    catch {
      error.value = 'Failed to load leaderboard.'
    }
    finally {
      loading.value = false
    }
  }

  async function fetchOwnLoqholderRank(authFetch: <T>(url: string) => Promise<T>) {
    try {
      // A user with no row in the ranked view (e.g. never controlled a loq)
      // gets an empty response body, which ofetch parses as undefined —
      // normalize that to null so it matches the null-safe prop type below.
      ownLoqholderRank.value = (await authFetch<LeaderboardLoqholder | null>('/api/leaderboard/loqholders/me')) ?? null
    }
    catch {
      ownLoqholderRank.value = null
    }
  }

  async function fetchOwnLoqeeRank(authFetch: <T>(url: string) => Promise<T>) {
    try {
      ownLoqeeRank.value = (await authFetch<LeaderboardLoqee | null>('/api/leaderboard/loqees/me')) ?? null
    }
    catch {
      ownLoqeeRank.value = null
    }
  }

  return {
    loqholders,
    loqees,
    loading,
    error,
    fetchLoqholders,
    fetchLoqees,
    ownLoqholderRank,
    ownLoqeeRank,
    fetchOwnLoqholderRank,
    fetchOwnLoqeeRank,
  }
}
