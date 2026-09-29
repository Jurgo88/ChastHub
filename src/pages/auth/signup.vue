<script setup lang="ts">
import type { UserRole } from '~/types'
import loqholderIcon from '~/assets/images/icons/loqholder-icon.webp'
import loqeeIcon from '~/assets/images/icons/loqee-icon.webp'

definePageMeta({ layout: 'auth' })

const { public: { signupsEnabled } } = useRuntimeConfig()

// 3 = "check your inbox", only reachable when email confirmation is on.
const step = ref<1 | 2 | 3>(1)
const email = ref('')
const password = ref('')
// Landing page CTAs preselect the role: /auth/signup?role=wearer|keyholder
// (UI words in the URL, DB values in state).
const roleParam = useRoute().query.role
const role = ref<UserRole | null>(roleParam === 'keyholder' ? 'loqholder' : roleParam === 'wearer' ? 'loqee' : null)
const termsAccepted = ref(false)
const error = ref('')
const loading = ref(false)

const { signup, loginWithGoogle, resendConfirmation } = useAuth()
const oauthLoading = ref(false)

// TASK-123
const confirmationSent = ref(true)
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
    // TASK-164 — carry where they came from through Google and back.
    await loginWithGoogle({ carrySource: true })
  }
  catch (e: unknown) {
    const fe = e as { message?: string }
    error.value = fe?.message ?? 'Google sign-up failed'
    oauthLoading.value = false
  }
}

function validateStep1(): boolean {
  if (!email.value || !password.value) {
    error.value = 'Email and password are required'
    return false
  }
  if (password.value.length < 8) { error.value = 'Password must be at least 8 characters'; return false }
  if (!/[A-Z]/.test(password.value)) { error.value = 'Password must contain an uppercase letter'; return false }
  if (!/[a-z]/.test(password.value)) { error.value = 'Password must contain a lowercase letter'; return false }
  if (!/[0-9]/.test(password.value)) { error.value = 'Password must contain a number'; return false }
  return true
}

function goToStep2() {
  error.value = ''
  if (validateStep1()) step.value = 2
}

async function handleSignup() {
  if (!role.value) { error.value = 'Please select a role'; return }
  if (!termsAccepted.value) { error.value = 'Please confirm you are 18+ and agree to the Terms and Privacy Policy'; return }
  loading.value = true
  error.value = ''
  try {
    const result = await signup(email.value, password.value, role.value, termsAccepted.value)
    if (result?.confirmationRequired) {
      confirmationSent.value = result.confirmationSent
      step.value = 3
    }
  }
  catch (e: unknown) {
    const fe = e as { data?: { message?: string }; message?: string }
    error.value = fe?.data?.message ?? fe?.message ?? 'Signup failed'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="signup">
    <template v-if="!signupsEnabled">
      <h1 class="signup__title">Signups aren't open yet</h1>
      <p class="signup__sub">Public signups are currently closed. Please check back soon.</p>
      <NuxtLink to="/auth/login" class="btn btn--primary btn--full">Log in</NuxtLink>
    </template>

    <template v-else>
    <!-- Step 1: Credentials -->
    <template v-if="step === 1">
      <h1 class="signup__title">Create account</h1>
      <p class="signup__sub">Step 1 of 2 — Your credentials</p>

      <form class="form" @submit.prevent="goToStep2">
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
            autocomplete="new-password"
            placeholder="Min 8 chars, upper, lower, number"
            required
          >
        </div>

        <p v-if="error" class="form__error">{{ error }}</p>

        <button type="submit" class="btn btn--primary btn--full">
          Continue
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
        {{ oauthLoading ? 'Redirecting…' : 'Sign up with Google' }}
      </button>
    </template>

    <!-- Step 3: Confirm your email (TASK-123) -->
    <template v-else-if="step === 3">
      <h1 class="signup__title">Check your inbox</h1>
      <p class="signup__sub">
        We sent a confirmation link to <strong>{{ email }}</strong>. Click it to activate
        your account, then log in.
      </p>

      <p v-if="!confirmationSent" class="form__error">
        We couldn't send the mail just now — use Resend below.
      </p>

      <div class="signup__actions">
        <button class="btn btn--ghost" type="button" :disabled="resending" @click="handleResend">
          {{ resending ? 'Sending…' : 'Resend email' }}
        </button>
        <NuxtLink to="/auth/login" class="btn btn--primary">Go to log in</NuxtLink>
      </div>

      <p v-if="resendNotice" class="signup__sub">{{ resendNotice }}</p>
    </template>

    <!-- Step 2: Role selection -->
    <template v-else>
      <h1 class="signup__title">I am a…</h1>
      <p class="signup__sub">Step 2 of 2 — Choose your role</p>

      <div class="role-cards">
        <button
          class="role-card"
          :class="{ 'role-card--active': role === 'loqholder' }"
          type="button"
          @click="role = 'loqholder'"
        >
          <img :src="loqholderIcon" width="28" height="28" alt="" class="role-card__icon">
          <span class="role-card__label">Keyholder</span>
          <span class="role-card__desc">I control the lock</span>
        </button>

        <button
          class="role-card"
          :class="{ 'role-card--active': role === 'loqee' }"
          type="button"
          @click="role = 'loqee'"
        >
          <img :src="loqeeIcon" width="28" height="28" alt="" class="role-card__icon">
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

      <p v-if="error" class="form__error">{{ error }}</p>

      <div class="signup__actions">
        <button class="btn btn--ghost" type="button" @click="step = 1">
          Back
        </button>
        <button
          class="btn btn--primary"
          :disabled="loading || !termsAccepted"
          type="button"
          @click="handleSignup"
        >
          {{ loading ? 'Creating account…' : 'Create account' }}
        </button>
      </div>
    </template>

    <p class="signup__footer">
      Already have an account?
      <NuxtLink to="/auth/login">Log in</NuxtLink>
    </p>
    </template>
  </div>
</template>

<style scoped lang="scss">
.signup {
  color: #fff;

  &__title {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 0.25rem;
    color: #fff;
  }

  &__sub {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.4);
    margin-bottom: 1.75rem;
  }

  &__actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  &__footer {
    margin-top: 1.5rem;
    text-align: center;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.35);

    a {
      color: var(--color-accent);
      text-decoration: none;

      &:hover { color: var(--color-accent); }
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

  &__error {
    font-size: 0.875rem;
    color: #e74c3c;
  }
}

.consent {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  margin-top: 1.25rem;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;

  input {
    margin-top: 0.15rem;
    flex-shrink: 0;
    cursor: pointer;
  }

  a {
    color: var(--color-accent);
    text-decoration: none;

    &:hover { color: var(--color-accent); }
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
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 14px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;

  &:hover {
    border-color: rgba(var(--color-accent-rgb), 0.35);
    background: rgba(var(--color-accent-rgb), 0.04);
  }

  &--active {
    border-color: rgba(var(--color-accent-rgb), 0.6);
    background: rgba(var(--color-accent-rgb), 0.08);
    box-shadow: 0 0 20px rgba(var(--color-accent-rgb), 0.1);
  }

  &__icon {
    width: 1.75rem;
    height: 1.75rem;
    object-fit: contain;
  }

  &__label {
    font-weight: 600;
    color: #fff;
  }

  &__desc {
    font-size: 0.8125rem;
    color: rgba(255, 255, 255, 0.4);
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
    background: var(--color-accent);
    color: var(--color-on-accent);
    flex: 1;
    box-shadow: 0 0 20px rgba(var(--color-accent-rgb), 0.35);

    &:hover:not(:disabled) {
      background: var(--color-accent);
      box-shadow: 0 0 30px rgba(var(--color-accent-rgb), 0.55);
      transform: translateY(-1px);
    }
  }

  &--ghost {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.7);

    &:hover:not(:disabled) {
      border-color: rgba(255, 255, 255, 0.3);
      color: #fff;
    }
  }

  &--full {
    width: 100%;
    margin-top: 0.5rem;
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
