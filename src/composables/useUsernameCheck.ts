export type UsernameAvailability = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error'

const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,19}$/

// Debounced live check for a username field. The format is validated locally
// first, so the server is only asked about names that could be valid.
export function useUsernameCheck(delay = 350) {
  const { authFetch } = useAuthFetch()
  const availability = ref<UsernameAvailability>('idle')
  let timer: ReturnType<typeof setTimeout> | undefined
  let seq = 0

  function checkUsername(value: string) {
    clearTimeout(timer)
    const username = value.trim().toLowerCase()
    if (!username) { availability.value = 'idle'; return }
    if (!USERNAME_PATTERN.test(username)) { availability.value = 'invalid'; return }

    availability.value = 'checking'
    const mine = ++seq
    timer = setTimeout(async () => {
      try {
        const res = await authFetch<{ available: boolean; reason?: string }>('/api/profile/username-available', { params: { u: username } })
        if (mine !== seq) return
        availability.value = res.available ? 'available' : res.reason === 'invalid' ? 'invalid' : 'taken'
      }
      catch {
        if (mine === seq) availability.value = 'error'
      }
    }, delay)
  }

  onBeforeUnmount(() => clearTimeout(timer))

  return { availability, checkUsername }
}
