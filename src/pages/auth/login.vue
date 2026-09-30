<script setup lang="ts">
definePageMeta({ layout: 'auth', authAside: 'login' })

const { public: { signupsEnabled } } = useRuntimeConfig()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const { login, loginWithProvider, resendConfirmation } = useAuth()
const oauthLoading = ref<'' | 'google' | 'x'>('')
const xLoginEnabled = useRuntimeConfig().public.xLoginEnabled

// TASK-123 — shown only after the server says the address is unconfirmed.
const needsConfirmation = ref(false)
const resending = ref(false)
const resendNotice = ref('')

async function handleResend() {
  resending.value = true
  resendNotice.value = ''
  try {
    await resendConfirmation(email.value)
    resendNotice.value = 'Sent. Give it a minute, and check your spam folder.'
  }
  catch (e: unknown) {
    const fe = e as { data?: { message?: string }; message?: string }
    resendNotice.value = fe?.data?.message ?? fe?.message ?? 'Could not resend right now.'
  }
  finally {
    resending.value = false
  }
}

// Google or X. On signup the visitor's source rides along through the
// provider and back (TASK-164).
async function handleOAuth(provider: 'google' | 'x') {
  oauthLoading.value = provider
  try {
    await loginWithProvider(provider, {})
  }
  catch (e: unknown) {
    const fe = e as { message?: string }
    error.value = fe?.message ?? `${provider === 'x' ? 'X' : 'Google'} sign-in failed`
    oauthLoading.value = ''
  }
}

async function handleLogin() {
  if (!email.value || !password.value) {
    error.value = 'Email and password are required'
    return
  }
  loading.value = true
  error.value = ''
  needsConfirmation.value = false
  resendNotice.value = ''
  try {
    await login(email.value, password.value)
  }
  catch (e: unknown) {
    const fe = e as { data?: { message?: string; data?: { code?: string } }; message?: string }
    error.value = fe?.data?.message ?? fe?.message ?? 'Login failed'
    needsConfirmation.value = fe?.data?.data?.code === 'email_not_confirmed'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="auth-title">Welcome back</h1>
    <p class="auth-sub">Log in to check on your locks.</p>

    <button class="btn btn--google" :disabled="!!oauthLoading" type="button" @click="handleOAuth('google')">
        <svg class="btn__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      {{ oauthLoading === 'google' ? 'Redirecting…' : 'Continue with Google' }}
    </button>
    <button v-if="xLoginEnabled" class="btn btn--x" :disabled="!!oauthLoading" type="button" @click="handleOAuth('x')">
      <svg class="btn__icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      {{ oauthLoading === 'x' ? 'Redirecting…' : 'Continue with X' }}
    </button>
    <p class="oauth-note">We never post anything or show your account name.</p>

    <div class="divider">or with email</div>

    <form class="form" @submit.prevent="handleLogin">
      <div class="form__field">
        <label for="email">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          autocomplete="email"
          placeholder="you@example.com"
          required
        >
      </div>

      <div class="form__field">
        <div class="form__row">
          <label for="password">Password</label>
          <NuxtLink class="form__forgot" to="/auth/reset-password">Forgot password?</NuxtLink>
        </div>
        <AuthPassword id="password" v-model="password" autocomplete="current-password" placeholder="Your password" />
      </div>

      <p v-if="error" class="form__error" role="alert">{{ error }}</p>

      <!-- TASK-123: the fix for this error is a resend, not a password reset -->
      <template v-if="needsConfirmation">
        <button class="btn btn--ghost btn--full" type="button" :disabled="resending" @click="handleResend">
          {{ resending ? 'Sending…' : 'Resend confirmation email' }}
        </button>
        <p v-if="resendNotice" class="form__hint">{{ resendNotice }}</p>
      </template>

      <button class="btn btn--primary" type="submit" :disabled="loading">
        {{ loading ? 'Logging in…' : 'Log in' }}
      </button>
    </form>

    <p v-if="signupsEnabled" class="auth-footer">
      New to ChastHub?
      <NuxtLink to="/auth/signup">Create an account</NuxtLink>
    </p>
  </div>
</template>
