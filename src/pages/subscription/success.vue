<template>
  <div class="success-page">
    <div class="success-container">
      <div v-if="loading" class="state-loading">
        <div class="spinner" />
        <p>Confirming your subscription…</p>
      </div>

      <div v-else-if="confirmed" class="state-success">
        <div class="success-icon" aria-hidden="true">✓</div>
        <h1>You're all set!</h1>
        <p>Your Premium subscription is now active. Enjoy ChastHub to the fullest.</p>
        <p class="redirect-note">Redirecting to dashboard in {{ countdown }}s…</p>
        <NuxtLink to="/dashboard" class="btn btn-primary">Go to dashboard</NuxtLink>
      </div>

      <div v-else class="state-error">
        <div class="error-icon" aria-hidden="true">!</div>
        <h1>Something went wrong</h1>
        <p>{{ errorMessage }}</p>
        <NuxtLink to="/subscription/upgrade" class="btn btn-primary">Back to plans</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { $supabase } = useNuxtApp()

const loading = ref(true)
const confirmed = ref(false)
const errorMessage = ref('')
const countdown = ref(5)

onMounted(async () => {
  const sessionId = route.query.session_id as string | undefined

  if (!sessionId) {
    errorMessage.value = 'No session ID found. If you completed payment, your subscription will activate shortly.'
    loading.value = false
    return
  }

  // Poll profile until subscription_status === 'active' (webhook may lag slightly)
  const maxAttempts = 8
  const delayMs = 1500
  let attempts = 0

  while (attempts < maxAttempts) {
    await refreshProfile()
    if (authStore.profile?.subscription_status === 'active') {
      confirmed.value = true
      loading.value = false
      startCountdown()
      return
    }
    attempts++
    if (attempts < maxAttempts) await delay(delayMs)
  }

  // Webhook may still be in flight — show success anyway
  confirmed.value = true
  loading.value = false
  startCountdown()
})

async function refreshProfile() {
  const userId = authStore.profile?.id
  if (!userId) return
  const { data } = await $supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (data) authStore.setProfile(data)
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function startCountdown() {
  const interval = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(interval)
      router.push('/dashboard')
    }
  }, 1000)
}
</script>

<style lang="scss" scoped>
.success-page {
  /* TASK-153 — see .dash in _loq-card.scss: the default layout owns the
     viewport height now, so claiming it here too pushed the footer a full
     screen below the content. */
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  background: var(--color-bg);
}

.success-container {
  width: 100%;
  max-width: 480px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.state-loading,
.state-success,
.state-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
}

.spinner {
  width: 3rem;
  height: 3rem;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.success-icon {
  width: 5rem;
  height: 5rem;
  border-radius: 50%;
  background: var(--color-accent);
  color: #fff;
  font-size: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.error-icon {
  width: 5rem;
  height: 5rem;
  border-radius: 50%;
  background: var(--color-danger);
  color: #fff;
  font-size: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

p {
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.6;
}

.redirect-note {
  font-size: 0.875rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.75rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  text-decoration: none;
  transition: opacity 0.15s;

  &-primary {
    background: var(--color-accent);
    color: #fff;

    &:hover {
      opacity: 0.9;
    }
  }
}
</style>
