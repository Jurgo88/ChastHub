<script setup lang="ts">
definePageMeta({ layout: 'auth', authAside: 'reset' })

const route = useRoute()
const router = useRouter()
const { $supabase } = useNuxtApp()
const { updatePassword, logout } = useAuth()

const email = ref('')
const newPassword = ref('')
const error = ref('')
const loading = ref(false)
const success = ref(false)

// TASK-155 — the "Reset password" email template links here with
// ?token_hash=…&type=recovery. The old check looked for ?code=, which only a
// PKCE client gets; ours runs the SDK's default implicit flow, so the link
// landed with #access_token=… instead (already consumed and cleared by the SDK
// before this page mounts) and the user was shown the request form again.
// A token hash verified here works on any device, whichever browser the mail
// app opens.
const tokenHash = route.query.token_hash as string | undefined
const isResetMode = ref(!!tokenHash)
const verifying = ref(!!tokenHash)

onMounted(async () => {
  if (!tokenHash) return
  const { error: err } = await $supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
  // The hash is single-use — drop it so a reload doesn't retry a spent token.
  await router.replace({ query: {} })
  verifying.value = false
  if (err) {
    isResetMode.value = false
    error.value = 'This reset link is invalid or has expired. Enter your email to get a new one.'
  }
})

async function requestReset() {
  if (!email.value) { error.value = 'Email is required'; return }
  loading.value = true
  error.value = ''
  try {
    const { error: err } = await $supabase.auth.resetPasswordForEmail(email.value, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (err) throw err
    success.value = true
  }
  catch (e: unknown) {
    const fe = e as { message?: string }
    error.value = fe?.message ?? 'Failed to send reset email'
  }
  finally {
    loading.value = false
  }
}

async function setNewPassword() {
  if (newPassword.value.length < 8) {
    error.value = 'Password must be at least 8 characters'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await updatePassword(newPassword.value)
    success.value = true
    // Ends the recovery session and every other one (signOut defaults to
    // global scope), so the new password is what signs back in everywhere.
    setTimeout(() => logout(), 2500)
  }
  catch (e: unknown) {
    const fe = e as { message?: string }
    error.value = fe?.message ?? 'Failed to update password'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="reset">
    <!-- New password form (arrived via email link) -->
    <template v-if="isResetMode">
      <h1 class="auth-title">Set new password</h1>

      <p v-if="verifying" class="auth-sub">Checking your reset link…</p>

      <template v-else-if="!success">
        <form class="form" @submit.prevent="setNewPassword">
          <div class="form__field">
            <label for="new-password">New password</label>
            <AuthPassword id="new-password" v-model="newPassword" autocomplete="new-password" placeholder="Create a new password" rules />
          </div>

          <p v-if="error" class="form__error">{{ error }}</p>

          <button class="btn btn--primary" type="submit" :disabled="loading">
            {{ loading ? 'Updating…' : 'Update password' }}
          </button>
        </form>
      </template>

      <p v-else class="auth-notice">
        Password updated. Redirecting to login…
      </p>
    </template>

    <!-- Request reset email form -->
    <template v-else>
      <h1 class="auth-title">Forgot password?</h1>
      <p class="auth-sub">Enter your email and we'll send you a reset link.</p>

      <template v-if="!success">
        <form class="form" @submit.prevent="requestReset">
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

          <p v-if="error" class="form__error">{{ error }}</p>

          <button class="btn btn--primary" type="submit" :disabled="loading">
            {{ loading ? 'Sending…' : 'Send reset link' }}
          </button>
        </form>
      </template>

      <p v-else class="auth-notice">
        Check your inbox. A reset link is on its way.
      </p>
    </template>

    <p class="auth-footer">
      <NuxtLink to="/auth/login">Back to log in</NuxtLink>
    </p>
  </div>
</template>

