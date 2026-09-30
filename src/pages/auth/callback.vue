<script setup lang="ts">
import type { UserRole, Profile } from '~/types'

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

  // No profile means this Google or X account has not finished signing up —
  // there is no auth.users trigger creating one any more (migration 001), so
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
      <p class="auth-sub" style="text-align: center; padding: 32px 0">Signing you in…</p>
    </template>

    <template v-else-if="step === 'role'">
      <h1 class="auth-title">Almost there</h1>
      <p class="auth-sub">Pick your role to finish signing up. You can't switch it later.</p>

      <AuthRoleCards v-model="role" />

      <label class="consent">
        <input v-model="termsAccepted" type="checkbox">
        <span>
          I confirm I am 18 or older and agree to the
          <NuxtLink to="/terms" target="_blank">Terms of Service</NuxtLink> and
          <NuxtLink to="/privacy" target="_blank">Privacy Policy</NuxtLink>.
        </span>
      </label>

      <p v-if="error" class="form__error" role="alert" style="margin-top: 16px">{{ error }}</p>

      <button
        class="btn btn--primary btn--full"
        style="margin-top: 24px"
        :disabled="loading || !role || !termsAccepted"
        type="button"
        @click="handleCompleteSignup"
      >
        {{ loading ? 'Setting up…' : 'Continue' }}
      </button>
    </template>

    <template v-else>
      <p class="form__error" role="alert">{{ error }}</p>
      <NuxtLink to="/auth/login" class="btn btn--ghost btn--full" style="margin-top: 16px">Back to log in</NuxtLink>
    </template>
  </div>
</template>

