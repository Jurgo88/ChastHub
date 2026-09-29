<template>
  <div class="profile-page">
    <AppNav />
    <div class="profile-layout">

      <!-- Live preview: mirrors the public /user/[username] card -->
      <aside class="profile-preview">
        <p class="profile-preview__label">How others see you</p>
        <div class="profile-preview__card">
          <UserAvatar
            class="profile-preview__avatar"
            :avatar-url="form.avatar_url"
            :display-name="form.display_name"
          />
          <h1 class="profile-preview__name">{{ form.display_name || 'ChastHub user' }}</h1>
          <p class="profile-preview__username">
            <template v-if="form.username">@{{ form.username }}</template>
            <template v-else>{{ authStore.profile?.email }}</template>
            <button
              v-if="form.username"
              class="copy-link-btn"
              :class="{ 'copy-link-btn--done': copiedLink }"
              @click="copyProfileLink"
            >
              {{ copiedLink ? '✓ Copied' : '🔗 Copy link' }}
            </button>
          </p>
          <span class="role-badge" :class="`role-badge--${authStore.profile?.role}`">
            <img v-if="roleIcon(authStore.profile?.role)" :src="roleIcon(authStore.profile?.role)" alt="" class="role-badge__icon">
            {{ roleLabel(authStore.profile?.role) }}
          </span>
          <p v-if="form.bio" class="profile-preview__bio">{{ form.bio }}</p>
          <p class="profile-preview__meta">Member since {{ memberSince }}</p>
          <NuxtLink v-if="form.username" :to="`/user/${form.username}`" class="profile-preview__cta">
            View public profile ↗
          </NuxtLink>
        </div>
      </aside>

      <div class="profile-settings">

        <!-- Edit profile -->
        <section class="profile-card">
          <h2 class="profile-card__title">Edit profile</h2>

          <div class="form-group">
            <label class="form-label">Display name</label>
            <input
              v-model="form.display_name"
              type="text"
              class="form-input"
              maxlength="50"
              placeholder="How others see you"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Username</label>
            <div class="username-input">
              <span class="username-input__prefix">chasthub.com/user/</span>
              <input
                v-model="form.username"
                type="text"
                class="form-input username-input__field"
                maxlength="20"
                placeholder="yourname"
                @input="form.username = form.username.toLowerCase().replace(/[^a-z0-9_]/g, '')"
              />
            </div>
            <span class="form-hint">3-20 characters: lowercase letters, numbers, underscores. Starts with a letter.</span>
          </div>

          <div class="form-group">
            <label class="form-label">Bio</label>
            <textarea
              v-model="form.bio"
              class="form-input form-input--textarea"
              maxlength="500"
              rows="3"
              placeholder="A little about you (optional)"
            />
            <span class="form-hint">{{ form.bio.length }}/500</span>
          </div>

          <div class="form-group">
            <label class="form-label">Avatar</label>
            <div class="avatar-picker">
              <!-- TASK-151 — the swatches used to be flat colour fills, which
                   was honest while the presets were colours. Now that each one
                   is artwork, showing the colour would be showing something
                   other than what gets picked. -->
              <button
                v-for="preset in AVATAR_PRESETS"
                :key="preset.key"
                type="button"
                class="avatar-swatch"
                :class="{ 'avatar-swatch--active': selectedPresetKey === preset.key }"
                :style="{ '--avatar-halo': preset.color }"
                :aria-label="`${preset.key} avatar`"
                :disabled="savingAvatar"
                @click="selectPreset(preset.key)"
              >
                <img :src="preset.src" alt="" width="256" height="256" class="avatar-swatch__img" decoding="async">
              </button>
              <label class="avatar-swatch avatar-swatch--upload" :class="{ 'avatar-swatch--active': isCustomAvatarImage }">
                <input type="file" accept="image/*" class="avatar-upload-input" :disabled="savingAvatar" @change="handleAvatarUpload">
                <span>{{ savingAvatar ? '…' : '+' }}</span>
              </label>
            </div>
            <p v-if="avatarError" class="form-error">{{ avatarError }}</p>
          </div>

          <div class="profile-card__foot">
            <p v-if="profileError" class="form-error">{{ profileError }}</p>
            <p v-else-if="profileSuccess" class="form-success">{{ profileSuccess }}</p>
            <button class="btn btn--primary" :disabled="savingProfile" @click="saveProfile">
              {{ savingProfile ? 'Saving…' : 'Save changes' }}
            </button>
          </div>
        </section>

        <!-- Get the app (TASK-105) -->
        <section v-if="pwaShowPrompt" class="profile-card">
          <h2 class="profile-card__title">Get the app</h2>
          <InstallPrompt />
        </section>

        <!-- Privacy & Notifications -->
        <section class="profile-card">
          <h2 class="profile-card__title">Privacy &amp; Notifications</h2>

          <div class="toggle-row">
            <div>
              <span class="toggle-row__label">Show on leaderboard</span>
              <p class="toggle-row__hint">List you in the public top loqholders/loqees ranking.</p>
            </div>
            <button
              class="toggle"
              :class="{ 'toggle--on': !form.leaderboard_opt_out }"
              @click="toggleLeaderboard"
            >
              <span class="toggle__knob" />
            </button>
          </div>

          <div class="toggle-row">
            <div>
              <span class="toggle-row__label">Show me in search</span>
              <p class="toggle-row__hint">Let others find you by name or username in Messages → People.</p>
            </div>
            <button
              class="toggle"
              :class="{ 'toggle--on': !form.hide_from_search }"
              @click="toggleSearchVisibility"
            >
              <span class="toggle__knob" />
            </button>
          </div>

          <div class="toggle-row">
            <div>
              <span class="toggle-row__label">Show online status</span>
              <p class="toggle-row__hint">Let others see when you're online or your last-seen time.</p>
            </div>
            <button
              class="toggle"
              :class="{ 'toggle--on': form.show_online_status }"
              @click="toggleOnlineStatus"
            >
              <span class="toggle__knob" />
            </button>
          </div>

          <NotificationPermission />
        </section>

        <!-- Account -->
        <section class="profile-card">
          <h2 class="profile-card__title">Account</h2>

          <div class="account-row">
            <span class="account-row__label">Role</span>
            <span class="account-row__badges">
              <span class="role-badge" :class="`role-badge--${authStore.profile?.role}`">
                <img v-if="roleIcon(authStore.profile?.role)" :src="roleIcon(authStore.profile?.role)" alt="" class="role-badge__icon">
                {{ roleLabel(authStore.profile?.role) }}
              </span>
              <!-- TASK-128 — staff marker, same badge the messaging surfaces use -->
              <AdminBadge v-if="authStore.isAdmin" />
            </span>
          </div>
          <div v-if="authStore.profile?.role === 'loqee'" class="account-row">
            <span class="account-row__label">Subscription</span>
            <span
              class="status-badge"
              :class="authStore.hasAccess ? 'status-badge--active' : 'status-badge--pending'"
            >
              <!-- TASK-126 — a cancelled subscription stays active until the
                   period ends, so "Active" alone would be misleading. -->
              {{ subscriptionLabel }}
            </span>
          </div>
          <div class="account-row">
            <span class="account-row__label">Member since</span>
            <span class="account-row__value">{{ memberSince }}</span>
          </div>

          <details class="accordion">
            <summary class="accordion__trigger">
              <span class="accordion__trigger-label">
                <span class="accordion__trigger-title">Change password</span>
                <span class="accordion__trigger-hint">Only applies to email/password accounts</span>
              </span>
              <span class="accordion__chev">▾</span>
            </summary>
            <div class="accordion__body">
              <div class="form-group">
                <label class="form-label">New password</label>
                <input
                  v-model="passwordForm.password"
                  type="password"
                  class="form-input"
                  placeholder="At least 8 characters"
                  autocomplete="new-password"
                />
              </div>
              <div class="form-group">
                <label class="form-label">Confirm password</label>
                <input
                  v-model="passwordForm.confirm"
                  type="password"
                  class="form-input"
                  placeholder="Repeat new password"
                  autocomplete="new-password"
                />
              </div>
              <div class="profile-card__foot profile-card__foot--tight">
                <p v-if="passwordError" class="form-error">{{ passwordError }}</p>
                <p v-else-if="passwordSuccess" class="form-success">{{ passwordSuccess }}</p>
                <button class="btn btn--primary" :disabled="savingPassword" @click="changePassword">
                  {{ savingPassword ? 'Updating…' : 'Update password' }}
                </button>
              </div>
            </div>
          </details>

          <!-- TASK-126 — the cancel endpoint has existed since launch but
               nothing in the UI ever called it. -->
          <div v-if="authStore.isSubscribed" class="account-actions">
            <div class="account-actions__row">
              <div class="account-actions__text">
                <span class="account-actions__title">Cancel subscription</span>
                <span class="account-actions__hint">
                  You keep wearer features until the end of the period you already paid for.
                </span>
              </div>
              <button class="btn btn--ghost" :disabled="cancelling" @click="cancelSubscriptionFlow">
                {{ cancelling ? 'Cancelling…' : 'Cancel' }}
              </button>
            </div>
            <p v-if="cancelError" class="form-error">{{ cancelError }}</p>
            <p v-else-if="cancelSuccess" class="form-success">{{ cancelSuccess }}</p>
          </div>

          <!-- TASK-122 — client asked for a log out inside the profile, not
               only behind the nav avatar. -->
          <div class="account-actions">
            <div class="account-actions__row">
              <div class="account-actions__text">
                <span class="account-actions__title">Log out</span>
                <span class="account-actions__hint">Sign out of ChastHub on this device.</span>
              </div>
              <button class="btn btn--ghost" @click="handleLogout">Log out</button>
            </div>
          </div>

          <!-- TASK-127 — deliberately here and not in the nav dropdown.
               Folded into the same accordion Change password uses, and with the
               red dropped: too many users were deleting on impulse, and a red
               button on a permanently visible row reads as the thing to press
               when you are annoyed. The consequences are still spelled out —
               now behind a deliberate open, and again in the dialog. -->
          <details class="accordion accordion--delete">
            <summary class="accordion__trigger">
              <span class="accordion__trigger-label">
                <span class="accordion__trigger-title">Delete account</span>
                <span class="accordion__trigger-hint">Permanently removes your ChastHub profile</span>
              </span>
              <span class="accordion__chev">▾</span>
            </summary>
            <div class="accordion__body">
              <p class="accordion__note">
                This cannot be undone. Your profile, display name and avatar are erased, any
                running lock ends immediately, and your subscription is cancelled at the end of
                the period you already paid for.
              </p>
              <div class="profile-card__foot profile-card__foot--tight">
                <p v-if="deleteError" class="form-error">{{ deleteError }}</p>
                <button class="btn btn--ghost" :disabled="deleting" @click="deleteAccountFlow">
                  {{ deleting ? 'Deleting…' : 'Delete account' }}
                </button>
              </div>
            </div>
          </details>
        </section>

      </div>
    </div>

    <DeleteAccountDialog
      :open="deleteDialogOpen"
      :subscribed="authStore.isSubscribed"
      :busy="deleting"
      @cancel="deleteDialogOpen = false"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import type { Subscription } from '~/types'
import { AVATAR_PRESETS, presetAvatarUrl, presetKeyFromAvatarUrl } from '~/utils/avatarPresets'
import { uploadAvatarPhoto } from '~/composables/useAvatar'

const { showPrompt: pwaShowPrompt } = usePwaInstall()
import loqholderIcon from '~/assets/images/icons/loqholder-icon.webp'
import loqeeIcon from '~/assets/images/icons/loqee-icon.webp'

definePageMeta({ middleware: 'auth' })

const ROLE_ICONS: Partial<Record<string, string>> = { loqholder: loqholderIcon, loqee: loqeeIcon }

function roleIcon(role: string | undefined) {
  return role ? ROLE_ICONS[role] : undefined
}

function roleLabel(role: string | undefined) {
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : ''
}

const authStore = useAuthStore()
const { authFetch } = useAuthFetch()
const { logout } = useAuth()
const { confirm } = useConfirm()
const { fetchStatus, cancelSubscription } = useSubscription()

const form = reactive({
  username: authStore.profile?.username ?? '',
  display_name: authStore.profile?.display_name ?? '',
  bio: authStore.profile?.bio ?? '',
  avatar_url: authStore.profile?.avatar_url ?? '',
  leaderboard_opt_out: authStore.profile?.leaderboard_opt_out ?? false,
  show_online_status: authStore.profile?.show_online_status ?? true,
  hide_from_search: authStore.profile?.hide_from_search ?? false,
})

const passwordForm = reactive({ password: '', confirm: '' })

const savingProfile = ref(false)
const profileError = ref('')
const profileSuccess = ref('')
const savingPassword = ref(false)
const passwordError = ref('')
const passwordSuccess = ref('')

const savingAvatar = ref(false)
const avatarError = ref('')

const copiedLink = ref(false)
async function copyProfileLink() {
  const username = authStore.profile?.username
  if (!username) return
  await navigator.clipboard.writeText(`${window.location.origin}/user/${username}`)
  copiedLink.value = true
  setTimeout(() => { copiedLink.value = false }, 2000)
}

const selectedPresetKey = computed(() => presetKeyFromAvatarUrl(form.avatar_url.trim()))
const isCustomAvatarImage = computed(() => !selectedPresetKey.value && form.avatar_url.trim().startsWith('https://'))

// TASK-126 — Stripe keeps a cancelled subscription active until the period
// ends; `subscription.cancel_at_period_end` is what distinguishes the two.
const subscription = ref<Subscription | null>(null)
const cancelling = ref(false)
const cancelError = ref('')
const cancelSuccess = ref('')

const periodEndLabel = computed(() => {
  const d = subscription.value?.current_period_end
  if (!d) return null
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
})

const subscriptionLabel = computed(() => {
  if (authStore.isOnTrial) {
    const d = authStore.trialDays
    return `Free trial · ${d} ${d === 1 ? 'day' : 'days'} left`
  }
  if (!authStore.isSubscribed) return authStore.profile?.trial_ends_at ? 'Trial ended' : 'Free'
  if (!subscription.value?.cancel_at_period_end) return 'Active'
  return periodEndLabel.value ? `Active · cancels ${periodEndLabel.value}` : 'Active · cancels at period end'
})

onMounted(async () => {
  if (authStore.profile?.role !== 'loqee') return
  try { subscription.value = await fetchStatus() }
  catch { /* the badge falls back to plain Active/Free */ }
})

async function cancelSubscriptionFlow() {
  cancelError.value = ''
  cancelSuccess.value = ''

  const ok = await confirm({
    title: 'Cancel your subscription?',
    message: periodEndLabel.value
      ? `You keep wearer features until ${periodEndLabel.value}, then your subscription ends. You can resubscribe any time.`
      : 'You keep wearer features until the end of the period you already paid for, then your subscription ends. You can resubscribe any time.',
    confirmLabel: 'Cancel subscription',
    cancelLabel: 'Keep it',
  })
  if (!ok) return

  cancelling.value = true
  try {
    await cancelSubscription()
    subscription.value = await fetchStatus()
    cancelSuccess.value = periodEndLabel.value
      ? `Cancelled. Your access runs until ${periodEndLabel.value}.`
      : 'Cancelled. Your access runs until the end of the current period.'
  }
  catch (err: unknown) {
    const e = err as { data?: { message?: string }; message?: string }
    cancelError.value = e?.data?.message ?? e?.message ?? 'Failed to cancel the subscription'
  }
  finally {
    cancelling.value = false
  }
}

async function handleLogout() {
  await logout()
}

// TASK-127 — two steps on purpose: the accordion has to be opened, and the
// dialog states the consequences before anything happens. Neither step is
// styled red (TASK-138): the wording carries the weight, a red button only
// adds urgency to a decision we would rather users took slowly.
//
// TASK-138 — the dialog also asks why they are leaving, which is the real
// friction here: it is one more deliberate choice, and the answer is the only
// signal we get about churn. It is not `confirm()` because useConfirm takes
// text and two labels and cannot host a form — see DeleteAccountDialog.
const deleting = ref(false)
const deleteError = ref('')
const deleteDialogOpen = ref(false)

function deleteAccountFlow() {
  deleteError.value = ''
  deleteDialogOpen.value = true
}

async function confirmDelete({ reason, note, report }: {
  reason: string
  note: string
  report?: { kind: 'bug' | 'security', message: string, allowContact: boolean }
}) {
  deleteError.value = ''
  deleting.value = true

  // TASK-176 — the report goes first: once the account is deleted the session
  // is gone and the server could no longer tell who sent it. A failed report
  // must never stop the deletion they asked for.
  if (report) {
    try {
      await authFetch('/api/security/report', {
        method: 'POST',
        body: {
          kind: report.kind,
          message: report.message,
          source: 'account_deletion',
          deletion_reason: reason,
          allow_contact: report.allowContact,
        },
      })
    }
    catch (err) {
      console.warn('[delete account] report not sent:', err)
    }
  }

  try {
    await authFetch('/api/profile/delete', {
      method: 'POST',
      body: { reason, note },
    })
    // The server has already invalidated the credentials; this clears the
    // local session and lands them on the login page.
    await logout()
  }
  catch (err: unknown) {
    const e = err as { data?: { message?: string }, message?: string }
    deleteError.value = e?.data?.message ?? e?.message ?? 'Failed to delete the account'
    deleting.value = false
    // Back to the page, where the error sits next to the button that opened
    // this — leaving the dialog up would hide it behind the overlay.
    deleteDialogOpen.value = false
  }
}

const memberSince = computed(() => {
  const d = authStore.profile?.created_at
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
})


async function saveProfile() {
  profileError.value = ''
  profileSuccess.value = ''
  savingProfile.value = true
  try {
    const updated = await authFetch<typeof authStore.profile>('/api/profile', {
      method: 'PATCH',
      body: {
        ...(form.username.trim() ? { username: form.username.trim() } : {}),
        display_name: form.display_name,
        bio: form.bio,
        avatar_url: form.avatar_url,
        leaderboard_opt_out: form.leaderboard_opt_out,
      },
    })
    if (updated) authStore.setProfile(updated)
    profileSuccess.value = 'Profile saved.'
  }
  catch (err: unknown) {
    const e = err as { data?: { message?: string } }
    profileError.value = e?.data?.message ?? 'Failed to save profile'
  }
  finally {
    savingProfile.value = false
  }
}

async function persistAvatar(avatarUrl: string) {
  avatarError.value = ''
  const previous = form.avatar_url
  form.avatar_url = avatarUrl
  savingAvatar.value = true
  try {
    const updated = await authFetch<typeof authStore.profile>('/api/profile', {
      method: 'PATCH',
      body: { avatar_url: avatarUrl },
    })
    if (updated) authStore.setProfile(updated)
  }
  catch (err: unknown) {
    form.avatar_url = previous
    const e = err as { data?: { message?: string } }
    avatarError.value = e?.data?.message ?? 'Failed to update avatar'
  }
  finally {
    savingAvatar.value = false
  }
}

function selectPreset(key: string) {
  if (savingAvatar.value) return
  persistAvatar(presetAvatarUrl(key))
}

async function handleAvatarUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  avatarError.value = ''
  savingAvatar.value = true
  try {
    const url = await uploadAvatarPhoto(file)
    await persistAvatar(url)
  }
  catch (err: unknown) {
    avatarError.value = (err as Error)?.message ?? 'Failed to upload avatar'
  }
  finally {
    savingAvatar.value = false
  }
}

async function changePassword() {
  passwordError.value = ''
  passwordSuccess.value = ''
  if (passwordForm.password.length < 8) {
    passwordError.value = 'Password must be at least 8 characters'
    return
  }
  if (passwordForm.password !== passwordForm.confirm) {
    passwordError.value = 'Passwords do not match'
    return
  }
  savingPassword.value = true
  try {
    await authFetch('/api/profile/change-password', {
      method: 'POST',
      body: { password: passwordForm.password },
    })
    passwordSuccess.value = 'Password updated.'
    passwordForm.password = ''
    passwordForm.confirm = ''
  }
  catch (err: unknown) {
    const e = err as { data?: { message?: string } }
    passwordError.value = e?.data?.message ?? 'Failed to update password'
  }
  finally {
    savingPassword.value = false
  }
}

async function toggleLeaderboard() {
  form.leaderboard_opt_out = !form.leaderboard_opt_out
  try {
    const updated = await authFetch<typeof authStore.profile>('/api/profile', {
      method: 'PATCH',
      body: { leaderboard_opt_out: form.leaderboard_opt_out },
    })
    if (updated) authStore.setProfile(updated)
  }
  catch {
    form.leaderboard_opt_out = !form.leaderboard_opt_out
  }
}

async function toggleSearchVisibility() {
  form.hide_from_search = !form.hide_from_search
  try {
    const updated = await authFetch<typeof authStore.profile>('/api/profile', {
      method: 'PATCH',
      body: { hide_from_search: form.hide_from_search },
    })
    if (updated) authStore.setProfile(updated)
  }
  catch {
    form.hide_from_search = !form.hide_from_search
  }
}

async function toggleOnlineStatus() {
  form.show_online_status = !form.show_online_status
  try {
    const updated = await authFetch<typeof authStore.profile>('/api/profile', {
      method: 'PATCH',
      body: { show_online_status: form.show_online_status },
    })
    if (updated) authStore.setProfile(updated)
  }
  catch {
    form.show_online_status = !form.show_online_status
  }
}
</script>

<style lang="scss" scoped>
@use '~/assets/styles/shared-ui' as *;

.profile-page {
  /* TASK-153 — see .dash in _loq-card.scss: the default layout owns the
     viewport height now, so claiming it here too pushed the footer a full
     screen below the content. */
  flex: 1;
  background: var(--color-bg);
  display: flex;
  flex-direction: column;
}

.profile-layout {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1rem 3rem;
  display: grid;
  grid-template-columns: 260px 1fr;
  align-items: start;
  gap: 2rem;

  @media (max-width: 800px) {
    grid-template-columns: 1fr;
  }
}

// ── Live preview ─────────────────────────────────────────────────────────────

.profile-preview {
  position: sticky;
  top: 1.5rem;

  @media (max-width: 800px) {
    position: static;
  }

  &__label {
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    margin: 0 0 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;

    &::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--color-border);
    }
  }

  &__card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 1rem;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  &__avatar {
    width: 5.25rem;
    height: 5.25rem;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &__name {
    font-size: 1.0625rem;
    font-weight: 700;
    color: var(--color-text);
    margin: 0.875rem 0 0;
  }

  &__username {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    margin: 0.25rem 0 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  &__bio {
    font-size: 0.8125rem;
    line-height: 1.55;
    color: var(--color-text);
    margin: 1rem 0 0;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
  }

  &__meta {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    margin: 1rem 0 0;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
    width: 100%;
  }

  &__cta {
    display: block;
    width: 100%;
    margin-top: 1rem;
    padding: 0.5rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font-size: 0.75rem;
    text-align: center;
    transition: border-color 0.15s, color 0.15s;
    box-sizing: border-box;

    &:hover {
      border-color: var(--color-accent);
      color: var(--color-accent);
      text-decoration: none;
    }
  }
}

.profile-preview__card .role-badge {
  margin-top: 0.625rem;
}

.copy-link-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;

  &:hover { border-color: var(--color-accent); color: var(--color-accent); }

  &--done {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
}

// ── Settings column ──────────────────────────────────────────────────────────

.profile-settings {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-width: 0;
}

.profile-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 1rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.125rem;

  &__title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text);
    margin: 0;
  }

  &__foot {
    display: flex;
    align-items: center;
    gap: 1rem;

    .form-error, .form-success {
      margin: 0;
      flex: 1;
    }

    .btn { margin-left: auto; }

    &--tight {
      margin-top: 0.25rem;
    }
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
}

.form-input {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  padding: 0.625rem 0.75rem;
  font-size: 0.9375rem;
  color: var(--color-text);
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s;

  &:focus {
    outline: none;
    border-color: var(--color-accent);
  }

  &--textarea {
    resize: vertical;
    min-height: 80px;
    font-family: inherit;
  }
}

.form-hint {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.username-input {
  display: flex;
  align-items: stretch;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  overflow: hidden;

  &__prefix {
    display: flex;
    align-items: center;
    padding: 0 0.75rem;
    background: var(--color-bg);
    color: var(--color-text-muted);
    font-size: 0.875rem;
    white-space: nowrap;
    border-right: 1px solid var(--color-border);
  }

  &__field {
    border: none;
    border-radius: 0;
  }
}

.avatar-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 0.625rem;
}

.avatar-swatch {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  box-sizing: border-box;
  overflow: hidden;
  transition: border-color 0.15s, transform 0.15s;
  box-shadow: 0 0 0.3rem color-mix(in srgb, var(--avatar-halo, transparent) 55%, transparent);

  &__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &:hover:not(:disabled) {
    transform: scale(1.08);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &--active {
    border-color: var(--color-accent);
  }

  &--upload {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg);
    border: 2px dashed var(--color-border);
    color: var(--color-text-muted);
    font-size: 1.125rem;
    overflow: hidden;
  }
}

.avatar-upload-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.form-error {
  font-size: 0.875rem;
  color: var(--color-danger);
  margin: 0;
}

.form-success {
  font-size: 0.875rem;
  color: var(--color-success, #38a169);
  margin: 0;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.625rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  flex-shrink: 0;
  transition: opacity 0.15s;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &--primary {
    background: var(--color-accent);
    color: #fff;

    &:hover:not(:disabled) {
      opacity: 0.9;
    }
  }
}

// ── Toggle rows ───────────────────────────────────────────────────────────────

.toggle-row {
  display: flex;
  align-items: flex-start;
  gap: 1rem;

  &__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text);
  }

  &__hint {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    margin: 0.125rem 0 0;
    line-height: 1.45;
  }

  > div:first-child {
    flex: 1;
  }
}


// ── Account rows ─────────────────────────────────────────────────────────────

.account-actions {
  border-top: 1px solid var(--color-border);
  padding-top: 1rem;

  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  &__text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }

  &__title {
    font-size: 0.875rem;
    color: var(--color-text);
    font-weight: 600;
  }

  &__hint {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
}

.account-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.375rem 0;

  &__badges {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.375rem;
    justify-content: flex-end;
  }

  &__label {
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  &__value {
    font-size: 0.875rem;
    color: var(--color-text);
  }
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;

  &--active {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  &--pending {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }
}

// ── Password accordion ───────────────────────────────────────────────────────

.accordion {
  border-top: 1px solid var(--color-border);
  margin-top: 0.375rem;
  padding-top: 0.875rem;
}

.accordion__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  cursor: pointer;
  list-style: none;

  &::-webkit-details-marker {
    display: none;
  }
}

.accordion__trigger-label {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.accordion__trigger-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
}

.accordion__trigger-hint {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.accordion__chev {
  color: var(--color-text-muted);
  font-size: 0.7rem;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.accordion[open] .accordion__chev {
  transform: rotate(180deg);
}

.accordion__body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 1rem;
}

.accordion__note {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--color-text-muted);
}

.accordion--delete {
  margin-top: 0.875rem;
}
</style>
