<script setup lang="ts">
definePageMeta({ layout: 'auth', authLogo: 'circle' })

const { public: { signupsEnabled } } = useRuntimeConfig()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const { login, loginWithGoogle, resendConfirmation } = useAuth()
const oauthLoading = ref(false)

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

async function handleGoogle() {
  oauthLoading.value = true
  try {
    await loginWithGoogle()
  }
  catch (e: unknown) {
    const fe = e as { message?: string }
    error.value = fe?.message ?? 'Google sign-in failed'
    oauthLoading.value = false
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
  <div class="login">
    <h1 class="login__title">Welcome back</h1>

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
        <label for="password">Password</label>
        <input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          placeholder="Your password"
          required
        >
        <NuxtLink class="form__forgot" to="/auth/reset-password">
          Forgot password?
        </NuxtLink>
      </div>

      <p v-if="error" class="form__error">{{ error }}</p>

      <!-- TASK-123 — the fix for this error is a resend, not a password reset -->
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

    <div class="divider">
      <span>or</span>
    </div>

    <button class="btn btn--google" :disabled="oauthLoading" type="button" @click="handleGoogle">
      <svg class="btn__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      {{ oauthLoading ? 'Redirecting…' : 'Continue with Google' }}
    </button>

    <p v-if="signupsEnabled" class="login__footer">
      Don't have an account?
      <NuxtLink to="/auth/signup">Sign up</NuxtLink>
    </p>
  </div>
</template>

<style scoped lang="scss">
.login {
  color: #fff;

  &__title {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 1.75rem;
    color: #fff;
  }

  &__footer {
    margin-top: 1.5rem;
    text-align: center;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.35);

    a {
      color: #6699ff;
      text-decoration: none;

      &:hover { color: #99bbff; }
    }
  }
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;

    label {
      font-size: 0.875rem;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.7);
    }

    input {
      padding: 0.75rem 1rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      font-size: 1rem;
      color: #fff;
      font-family: 'Inter', sans-serif;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;

      &::placeholder { color: rgba(255, 255, 255, 0.2); }

      &:focus {
        border-color: var(--color-accent);
        box-shadow: 0 0 0 3px rgba(var(--color-accent-rgb), 0.15);
      }
    }
  }

  &__forgot {
    font-size: 0.8125rem;
    align-self: flex-end;
    color: rgba(255, 255, 255, 0.4);
    text-decoration: none;

    &:hover { color: #6699ff; }
  }

  &__error {
    font-size: 0.875rem;
    color: #e74c3c;
  }

  // TASK-123 — neutral note under the resend button
  &__hint {
    font-size: 0.8125rem;
    color: rgba(255, 255, 255, 0.55);
  }
}

.btn {
  padding: 0.75rem 1.25rem;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  font-family: 'Inter', sans-serif;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &--primary {
    width: 100%;
    margin-top: 0.5rem;
    background: var(--color-accent);
    color: #fff;
    box-shadow: 0 0 20px rgba(var(--color-accent-rgb), 0.35);

    &:hover:not(:disabled) {
      background: #2233ff;
      box-shadow: 0 0 30px rgba(var(--color-accent-rgb), 0.55);
      transform: translateY(-1px);
    }
  }

  &--google {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.625rem;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.12);

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
    }
  }

  &__icon {
    width: 1.125rem;
    height: 1.125rem;
    flex-shrink: 0;
  }
}

.divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0.5rem 0;
  color: rgba(255, 255, 255, 0.25);
  font-size: 0.8125rem;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
  }
}
</style>
