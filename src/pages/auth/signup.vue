<script setup lang="ts">
import type { UserRole } from '~/types'

definePageMeta({ layout: 'auth', authAside: 'signup' })

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
  <div>
    <template v-if="!signupsEnabled">
      <h1 class="auth-title">Signups aren't open yet</h1>
      <p class="auth-sub">Public signups are closed for the moment. Please check back soon.</p>
      <NuxtLink to="/auth/login" class="btn btn--primary btn--full">Log in</NuxtLink>
    </template>

    <template v-else>
      <!-- Step 3: Confirm your email (TASK-123) -->
      <template v-if="step === 3">
        <h1 class="auth-title">Check your inbox</h1>
        <p class="auth-sub">
          We sent a confirmation link to <strong>{{ email }}</strong>. Click it to activate
          your account, then log in.
        </p>

        <p v-if="!confirmationSent" class="form__error">
          We couldn't send the email just now. Use Resend below.
        </p>

        <div class="auth-actions">
          <button class="btn btn--ghost" type="button" :disabled="resending" @click="handleResend">
            {{ resending ? 'Sending…' : 'Resend email' }}
          </button>
          <NuxtLink to="/auth/login" class="btn btn--primary">Go to log in</NuxtLink>
        </div>

        <p v-if="resendNotice" class="form__hint" style="margin-top: 16px">{{ resendNotice }}</p>
      </template>

      <template v-else>
        <div class="auth-steps" aria-hidden="true">
          <span class="auth-steps__bar auth-steps__bar--on" />
          <span class="auth-steps__bar" :class="{ 'auth-steps__bar--on': step === 2 }" />
        </div>

        <!-- Step 1: Credentials -->
        <template v-if="step === 1">
          <h1 class="auth-title">Create your account</h1>
          <p class="auth-sub">Locktober starts now. 30 days free for wearers, no card needed.</p>

          <button class="btn btn--google" :disabled="oauthLoading" type="button" @click="handleGoogle">
        <svg class="btn__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
            {{ oauthLoading ? 'Redirecting…' : 'Sign up with Google' }}
          </button>

          <div class="divider">or with email</div>

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
              <AuthPassword id="password" v-model="password" autocomplete="new-password" placeholder="Create a password" rules />
            </div>

            <p v-if="error" class="form__error" role="alert">{{ error }}</p>

            <button type="submit" class="btn btn--primary btn--full">Continue</button>
          </form>
        </template>

        <!-- Step 2: Role selection -->
        <template v-else>
          <h1 class="auth-title">How will you play?</h1>
          <p class="auth-sub">Pick your role. You can't switch it later, so choose the side you want to be on.</p>

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

          <div class="auth-actions">
            <button class="btn btn--ghost" type="button" @click="step = 1">Back</button>
            <button
              class="btn btn--primary"
              :disabled="loading || !role || !termsAccepted"
              type="button"
              @click="handleSignup"
            >
              {{ loading ? 'Creating…' : 'Create account' }}
            </button>
          </div>
        </template>
      </template>

      <p class="auth-footer">
        Already have an account?
        <NuxtLink to="/auth/login">Log in</NuxtLink>
      </p>
    </template>
  </div>
</template>
