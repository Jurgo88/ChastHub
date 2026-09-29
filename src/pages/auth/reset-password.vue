<script setup lang="ts">
definePageMeta({ layout: 'auth' })

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
      <h1 class="reset__title">Set new password</h1>

      <p v-if="verifying" class="reset__sub">Checking your reset link…</p>

      <template v-else-if="!success">
        <form class="form" @submit.prevent="setNewPassword">
          <div class="form__field">
            <label for="new-password">New password</label>
            <input
              id="new-password"
              v-model="newPassword"
              type="password"
              autocomplete="new-password"
              placeholder="Min 8 chars, upper, lower, number"
              required
            >
          </div>

          <p v-if="error" class="form__error">{{ error }}</p>

          <button class="btn btn--primary" type="submit" :disabled="loading">
            {{ loading ? 'Updating…' : 'Update password' }}
          </button>
        </form>
      </template>

      <p v-else class="reset__success">
        Password updated. Redirecting to login…
      </p>
    </template>

    <!-- Request reset email form -->
    <template v-else>
      <h1 class="reset__title">Forgot password?</h1>
      <p class="reset__sub">Enter your email and we'll send you a reset link.</p>

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

      <p v-else class="reset__success">
        Check your inbox — a reset link is on its way.
      </p>
    </template>

    <p class="reset__back">
      <NuxtLink to="/auth/login">← Back to login</NuxtLink>
    </p>
  </div>
</template>

<style scoped lang="scss">
.reset {
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

  &__success {
    margin-top: 1rem;
    padding: 0.875rem 1rem;
    background: rgba(var(--color-accent-rgb), 0.08);
    border: 1px solid rgba(var(--color-accent-rgb), 0.25);
    border-radius: 10px;
    color: #6699ff;
    font-size: 0.9375rem;
  }

  &__back {
    margin-top: 1.5rem;
    text-align: center;
    font-size: 0.875rem;

    a {
      color: rgba(255, 255, 255, 0.4);
      text-decoration: none;

      &:hover { color: #6699ff; }
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
}
</style>
