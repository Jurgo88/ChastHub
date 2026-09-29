<script setup lang="ts">
import type { UserRole, Profile } from '~/types'
import loqholderIcon from '~/assets/images/icons/loqholder-icon.webp'
import loqeeIcon from '~/assets/images/icons/loqee-icon.webp'

definePageMeta({ layout: 'auth' })

const { $supabase } = useNuxtApp()
const authStore = useAuthStore()

const step = ref<'loading' | 'role' | 'error'>('loading')
const role = ref<UserRole | null>(null)
const termsAccepted = ref(false)
const error = ref('')
const loading = ref(false)

onMounted(async () => {
  const { data: { session }, error: sessionError } = await $supabase.auth.getSession()

  if (sessionError || !session) {
    error.value = 'Authentication failed. Please try again.'
    step.value = 'error'
    return
  }

  authStore.setSession(session)

  // No profile means this Google account has not finished signing up —
  // there is no auth.users trigger creating one any more (migration 056), so
  // zero rows is expected here and .maybeSingle() is the honest query.
  const { data: profile } = await $supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle<Profile>()

  if (profile) {
    authStore.setProfile(profile)
    await navigateTo('/dashboard')
    return
  }

  step.value = 'role'
})

async function handleCompleteSignup() {
  if (!role.value) { error.value = 'Please select a role'; return }
  if (!termsAccepted.value) { error.value = 'Please confirm you are 18+ and agree to the Terms and Privacy Policy'; return }

  const { data: { session } } = await $supabase.auth.getSession()
  if (!session) { error.value = 'Session expired. Please try again.'; return }

  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/complete-oauth', {
      method: 'POST',
      // TASK-164 — the signup page put the source on this page's URL, and
      // the capture at app start read it back.
      body: { role: role.value, termsAccepted: termsAccepted.value, source: useSignupSource().get() },
      headers: { Authorization: `Bearer ${session.access_token}` },
    })

    const { data: profile } = await $supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle<Profile>()

    if (profile) authStore.setProfile(profile)
    await navigateTo('/dashboard')
  }
  catch (e: unknown) {
    const fe = e as { data?: { message?: string }; message?: string }
    error.value = fe?.data?.message ?? fe?.message ?? 'Failed to complete signup'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="callback">
    <template v-if="step === 'loading'">
      <p class="callback__loading">Signing you in…</p>
    </template>

    <template v-else-if="step === 'role'">
      <h1 class="callback__title">Almost there!</h1>
      <p class="callback__sub">Choose your role to complete signup.</p>

      <div class="role-cards">
        <button
          class="role-card"
          :class="{ 'role-card--active': role === 'loqholder' }"
          type="button"
          @click="role = 'loqholder'"
        >
          <img :src="loqholderIcon" alt="" class="role-card__icon">
          <span class="role-card__label">Keyholder</span>
          <span class="role-card__desc">I control the lock</span>
        </button>

        <button
          class="role-card"
          :class="{ 'role-card--active': role === 'loqee' }"
          type="button"
          @click="role = 'loqee'"
        >
          <img :src="loqeeIcon" alt="" class="role-card__icon">
          <span class="role-card__label">Wearer</span>
          <span class="role-card__desc">I am being locked</span>
        </button>
      </div>

      <label class="consent">
        <input v-model="termsAccepted" type="checkbox">
        <span>
          I confirm I am 18 years or older and agree to the
          <NuxtLink to="/terms" target="_blank">Terms of Service</NuxtLink> and
          <NuxtLink to="/privacy" target="_blank">Privacy Policy</NuxtLink>.
        </span>
      </label>

      <p v-if="error" class="callback__error">{{ error }}</p>

      <button
        class="btn btn--primary"
        :disabled="loading || !role || !termsAccepted"
        type="button"
        @click="handleCompleteSignup"
      >
        {{ loading ? 'Setting up…' : 'Continue' }}
      </button>
    </template>

    <template v-else>
      <p class="callback__error">{{ error }}</p>
      <NuxtLink to="/auth/login" class="btn btn--ghost">Back to login</NuxtLink>
    </template>
  </div>
</template>

<style scoped lang="scss">
.callback {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__loading {
    text-align: center;
    color: var(--color-muted);
    padding: 2rem 0;
  }

  &__title {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 0.25rem;
  }

  &__sub {
    font-size: 0.875rem;
    color: var(--color-muted);
    margin-bottom: 0.75rem;
  }

  &__error {
    font-size: 0.875rem;
    color: var(--color-accent);
  }
}

.role-cards {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.role-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 1.25rem;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  background: none;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  &--active {
    border-color: var(--color-accent);
    background: rgba(233, 69, 96, 0.05);
  }

  &__icon { width: 1.75rem; height: 1.75rem; object-fit: contain; }
  &__label { font-weight: 600; }
  &__desc { font-size: 0.8125rem; color: var(--color-muted); }
}

.consent {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  margin: 0.25rem 0 0.5rem;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--color-muted);
  cursor: pointer;

  input {
    margin-top: 0.15rem;
    flex-shrink: 0;
    cursor: pointer;
  }

  a {
    color: var(--color-accent);
    text-decoration: none;

    &:hover { text-decoration: underline; }
  }
}

.btn {
  padding: 0.625rem 1.25rem;
  border-radius: var(--radius-sm);
  font-size: 1rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
  width: 100%;
  margin-top: 0.5rem;

  &:disabled { opacity: 0.6; cursor: not-allowed; }
  &--primary { background: var(--color-accent); color: var(--color-on-accent); }
  &--ghost { background: transparent; border: 1px solid var(--color-border); color: var(--color-text); }
}
</style>
