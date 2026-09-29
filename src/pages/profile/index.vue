<template>
  <div class="profile-page">
    <AppNav />

    <div class="profile-wrap">
      <ProfileHero
        :display-name="authStore.profile?.display_name ?? null"
        :username="authStore.profile?.username ?? null"
        :avatar-url="authStore.profile?.avatar_url ?? null"
        :role="authStore.profile?.role"
        :age="authStore.profile?.show_age ? age : null"
        :gender="authStore.profile?.show_gender ? authStore.profile?.gender : null"
        :created-at="authStore.profile?.created_at"
        :stats="stats"
        self
      >
        <template #avatar>
          <label class="hero-cam" :class="{ 'hero-cam--busy': savingAvatar }" title="Change photo">
            <input type="file" accept="image/jpeg,image/png,image/webp" :disabled="savingAvatar" @change="handleAvatarUpload">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
            <span class="sr-only">Change photo</span>
          </label>
        </template>
        <template #actions>
          <button v-if="authStore.profile?.username" class="pbtn" type="button" @click="copyProfileLink">
            {{ copiedLink ? 'Copied' : 'Copy link' }}
          </button>
          <NuxtLink v-if="authStore.profile?.username" :to="`/user/${authStore.profile.username}`" class="pbtn pbtn--primary">
            View public profile
          </NuxtLink>
        </template>
      </ProfileHero>

      <div class="settings">
        <nav class="settings__menu" aria-label="Profile settings">
          <button
            v-for="t in TABS"
            :key="t.key"
            type="button"
            class="settings__tab"
            :class="{ 'settings__tab--on': tab === t.key }"
            :aria-current="tab === t.key ? 'page' : undefined"
            @click="setTab(t.key)"
          >
            <span class="settings__tab-long">{{ t.label }}</span>
            <span class="settings__tab-short">{{ t.short }}</span>
          </button>
        </nav>

        <!-- ── Profile ─────────────────────────────────────────────────── -->
        <section v-if="tab === 'profile'" class="ppanel">
          <h2 class="ppanel__title">Profile</h2>
          <p class="ppanel__sub">What other people see on your profile, in Key Drop and next to your locks.</p>

          <div class="photo">
            <UserAvatar class="photo__avatar" :avatar-url="authStore.profile?.avatar_url" :display-name="form.display_name" />
            <div class="photo__text">
              <strong>Profile photo</strong>
              <span>JPG, PNG or WebP, up to 5 MB. No explicit photos. Without a photo we show your initial.</span>
              <p v-if="avatarError" class="msg msg--error">{{ avatarError }}</p>
            </div>
            <div class="photo__actions">
              <label class="pbtn pbtn--sm" :class="{ 'pbtn--busy': savingAvatar }">
                <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" :disabled="savingAvatar" @change="handleAvatarUpload">
                {{ savingAvatar ? 'Uploading…' : hasPhoto ? 'Change' : 'Upload photo' }}
              </label>
              <button v-if="hasPhoto" type="button" class="pbtn pbtn--sm" :disabled="savingAvatar" @click="removePhoto">Remove</button>
            </div>
          </div>

          <div class="grid2">
            <div class="field">
              <label class="field__label" for="p-name">Display name</label>
              <input id="p-name" v-model="form.display_name" class="field__input" type="text" maxlength="50" placeholder="How others see you">
            </div>
            <div class="field">
              <label class="field__label" for="p-username">Username</label>
              <div class="uname" :class="usernameChanged ? `uname--${availability}` : ''">
                <span>chasthub.com/user/</span>
                <input id="p-username" v-model="form.username" type="text" maxlength="20" placeholder="yourname" autocomplete="off" @input="onUsernameInput">
              </div>
              <UsernameStatus :state="usernameChanged ? availability : 'idle'" />
            </div>
          </div>

          <div class="field">
            <label class="field__label" for="p-bio">Bio</label>
            <textarea id="p-bio" v-model="form.bio" class="field__input field__input--area" maxlength="500" rows="3" placeholder="A little about you and what you are looking for (optional)" />
            <span class="field__hint field__hint--right">{{ form.bio.length }}/500</span>
          </div>

          <div class="sep" />
          <div class="subhead">
            <h3>About you</h3>
            <span>Optional. You decide what is shown.</span>
          </div>

          <div class="grid2">
            <div class="field">
              <label class="field__label" for="p-year">Birth year</label>
              <select id="p-year" v-model="form.birth_year" class="field__input field__input--select">
                <option :value="null">Prefer not to say</option>
                <option v-for="y in YEARS" :key="y" :value="y">{{ y }}</option>
              </select>
              <button type="button" class="vis" :disabled="!form.birth_year" @click="form.show_age = !form.show_age">
                <span class="toggle toggle--mini" :class="{ 'toggle--on': form.show_age && form.birth_year }"><span class="toggle__knob" /></span>
                Show my age{{ form.birth_year ? ` (${ageFor(form.birth_year)})` : '' }} on profile
              </button>
            </div>
            <div class="field">
              <span class="field__label">Gender</span>
              <div class="chips" role="radiogroup" aria-label="Gender">
                <button
                  v-for="g in GENDER_OPTIONS"
                  :key="g.value"
                  type="button"
                  role="radio"
                  :aria-checked="form.gender === g.value"
                  class="chip"
                  :class="{ 'chip--on': form.gender === g.value }"
                  @click="form.gender = form.gender === g.value ? null : g.value"
                >
                  {{ g.label }}
                </button>
              </div>
              <button type="button" class="vis" :disabled="!form.gender" @click="form.show_gender = !form.show_gender">
                <span class="toggle toggle--mini" :class="{ 'toggle--on': form.show_gender && form.gender }"><span class="toggle__knob" /></span>
                Show on profile
              </button>
            </div>
          </div>

          <p v-if="profileError" class="msg msg--error">{{ profileError }}</p>
          <p v-else-if="profileSuccess" class="msg msg--ok">{{ profileSuccess }}</p>
        </section>

        <!-- ── Privacy ─────────────────────────────────────────────────── -->
        <section v-else-if="tab === 'privacy'" class="ppanel">
          <h2 class="ppanel__title">Privacy</h2>
          <p class="ppanel__sub">Changes save as soon as you flip a switch.</p>

          <div class="trow">
            <div>
              <span class="trow__label">Show me in rankings</span>
              <p class="trow__hint">Others see your name, photo and results in the rankings on Stats. Turned off, you are left out of every list and only anonymous totals include you.</p>
            </div>
            <button class="toggle" :class="{ 'toggle--on': !privacy.leaderboard_opt_out }" type="button" :aria-pressed="!privacy.leaderboard_opt_out" @click="togglePrivacy('leaderboard_opt_out')">
              <span class="toggle__knob" />
            </button>
          </div>
          <div class="trow">
            <div>
              <span class="trow__label">Let people find me</span>
              <p class="trow__hint">Others can search for your name or username in Messages. Turned off, only people with your profile link reach you.</p>
            </div>
            <button class="toggle" :class="{ 'toggle--on': !privacy.hide_from_search }" type="button" :aria-pressed="!privacy.hide_from_search" @click="togglePrivacy('hide_from_search')">
              <span class="toggle__knob" />
            </button>
          </div>
          <div class="trow">
            <div>
              <span class="trow__label">Show when I am online</span>
              <p class="trow__hint">Others see a green dot while you are here, and when you were last seen.</p>
            </div>
            <button class="toggle" :class="{ 'toggle--on': privacy.show_online_status }" type="button" :aria-pressed="privacy.show_online_status" @click="togglePrivacy('show_online_status')">
              <span class="toggle__knob" />
            </button>
          </div>
          <p v-if="privacyError" class="msg msg--error">{{ privacyError }}</p>
        </section>

        <!-- ── Notifications ───────────────────────────────────────────── -->
        <section v-else-if="tab === 'notifications'" class="ppanel">
          <h2 class="ppanel__title">Notifications</h2>
          <p class="ppanel__sub">Get a push when there is a new message, a lock request, or a lock ends.</p>
          <NotificationPermission />
          <div v-if="pwaShowPrompt" class="install">
            <div class="sep" />
            <div class="subhead"><h3>Get the app</h3></div>
            <InstallPrompt />
          </div>
        </section>

        <!-- ── Account ─────────────────────────────────────────────────── -->
        <section v-else class="ppanel">
          <h2 class="ppanel__title">Account</h2>
          <p class="ppanel__sub">Signed in as <strong class="email">{{ authStore.profile?.email }}</strong></p>

          <div v-if="authStore.profile?.role === 'loqee'" class="plan" :class="{ 'plan--over': !authStore.hasAccess }">
            <template v-if="authStore.isSubscribed">
              <div class="plan__top"><span>Subscription</span><span>{{ subscriptionLabel }}</span></div>
            </template>
            <template v-else-if="authStore.isOnTrial">
              <div class="plan__top">
                <span>Free trial</span>
                <span>{{ authStore.trialDays }} of {{ TRIAL_DAYS }} days left</span>
              </div>
              <div class="plan__bar"><i :style="{ width: `${trialPercent}%` }" /></div>
              <span class="plan__note">Everything is unlocked until {{ trialEndLabel }}.</span>
            </template>
            <template v-else>
              <div class="plan__top"><span>Free trial</span><span>Ended</span></div>
              <span class="plan__note">Your trial ended{{ trialEndLabel ? ` on ${trialEndLabel}` : '' }}.</span>
            </template>
          </div>

          <div v-if="authStore.isSubscribed" class="arow">
            <div class="arow__text">
              <span class="arow__title">Cancel subscription</span>
              <span class="arow__hint">You keep wearer features until the end of the period you already paid for.</span>
            </div>
            <button class="pbtn pbtn--sm" type="button" :disabled="cancelling" @click="cancelSubscriptionFlow">
              {{ cancelling ? 'Cancelling…' : 'Cancel' }}
            </button>
          </div>
          <p v-if="cancelError" class="msg msg--error">{{ cancelError }}</p>
          <p v-else-if="cancelSuccess" class="msg msg--ok">{{ cancelSuccess }}</p>

          <details class="acc">
            <summary class="acc__trigger">
              <span class="arow__text">
                <span class="arow__title">Change password</span>
                <span class="arow__hint">Only for accounts that sign in with email and password</span>
              </span>
              <span class="acc__chev" aria-hidden="true">▾</span>
            </summary>
            <div class="acc__body">
              <div class="grid2">
                <div class="field">
                  <label class="field__label" for="pw-new">New password</label>
                  <input id="pw-new" v-model="passwordForm.password" class="field__input" type="password" placeholder="At least 8 characters" autocomplete="new-password">
                </div>
                <div class="field">
                  <label class="field__label" for="pw-confirm">Confirm password</label>
                  <input id="pw-confirm" v-model="passwordForm.confirm" class="field__input" type="password" placeholder="Repeat new password" autocomplete="new-password">
                </div>
              </div>
              <div class="acc__foot">
                <p v-if="passwordError" class="msg msg--error">{{ passwordError }}</p>
                <p v-else-if="passwordSuccess" class="msg msg--ok">{{ passwordSuccess }}</p>
                <button class="pbtn pbtn--primary" type="button" :disabled="savingPassword" @click="changePassword">
                  {{ savingPassword ? 'Updating…' : 'Update password' }}
                </button>
              </div>
            </div>
          </details>

          <div class="arow">
            <div class="arow__text">
              <span class="arow__title">Log out</span>
              <span class="arow__hint">Sign out of ChastHub on this device.</span>
            </div>
            <button class="pbtn pbtn--sm" type="button" @click="logout()">Log out</button>
          </div>

          <div class="danger">
            <h3 class="danger__title">Danger zone</h3>
            <!-- TASK-127 — two deliberate steps (open, then the dialog) and no
                 red button: too many people deleted on impulse. -->
            <details class="acc acc--danger">
              <summary class="acc__trigger">
                <span class="arow__text">
                  <span class="arow__title">Delete account</span>
                  <span class="arow__hint">Permanently removes your ChastHub profile</span>
                </span>
                <span class="acc__chev" aria-hidden="true">▾</span>
              </summary>
              <div class="acc__body">
                <p class="acc__note">
                  This cannot be undone. Your profile, name and photo are erased, any running
                  lock ends immediately, and a subscription is cancelled at the end of the
                  period you already paid for.
                </p>
                <div class="acc__foot">
                  <p v-if="deleteError" class="msg msg--error">{{ deleteError }}</p>
                  <button class="pbtn pbtn--sm" type="button" :disabled="deleting" @click="openDelete">
                    {{ deleting ? 'Deleting…' : 'Delete account' }}
                  </button>
                </div>
              </div>
            </details>
          </div>
        </section>
      </div>
    </div>

    <Transition name="savebar">
      <div v-if="dirty" class="savebar" role="region" aria-label="Unsaved changes">
        <span class="savebar__text"><i aria-hidden="true" />Unsaved changes</span>
        <button class="pbtn pbtn--sm" type="button" :disabled="savingProfile" @click="discard">Discard</button>
        <button class="pbtn pbtn--sm pbtn--primary" type="button" :disabled="!canSave" @click="saveProfile">
          {{ savingProfile ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </Transition>

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
import type { Gender, Profile, ProfileStats, Subscription } from '~/types'
import { uploadAvatarPhoto } from '~/composables/useAvatar'
import { GENDER_OPTIONS } from '~/utils/profileLabels'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'Your profile | ChastHub' })

type Tab = 'profile' | 'privacy' | 'notifications' | 'account'
const TABS: { key: Tab; label: string; short: string }[] = [
  { key: 'profile', label: 'Profile', short: 'Profile' },
  { key: 'privacy', label: 'Privacy', short: 'Privacy' },
  { key: 'notifications', label: 'Notifications', short: 'Alerts' },
  { key: 'account', label: 'Account', short: 'Account' },
]
const TRIAL_DAYS = 30
const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const thisYear = new Date().getFullYear()
const YEARS = Array.from({ length: thisYear - 18 - 1920 + 1 }, (_, i) => thisYear - 18 - i)

const authStore = useAuthStore()
const { authFetch } = useAuthFetch()
const { logout } = useAuth()
const { confirm } = useConfirm()
const { fetchStatus, cancelSubscription } = useSubscription()
const { showPrompt: pwaShowPrompt } = usePwaInstall()
const { availability, checkUsername } = useUsernameCheck()
const route = useRoute()
const router = useRouter()

// ── Tabs (kept in the URL so a refresh or a shared link lands on the tab) ────
const tab = computed<Tab>(() => {
  const q = route.query.tab
  return TABS.some(t => t.key === q) ? q as Tab : 'profile'
})
function setTab(key: Tab) {
  router.replace({ query: { ...route.query, tab: key === 'profile' ? undefined : key } })
}

// ── Stats ────────────────────────────────────────────────────────────────────
const stats = ref<ProfileStats | null>(null)
onMounted(async () => {
  try { stats.value = await authFetch<ProfileStats>('/api/profile/stats') }
  catch { /* the header simply shows no stat row */ }
})

function ageFor(year: number) { return thisYear - year }
const age = computed(() => authStore.profile?.birth_year ? ageFor(authStore.profile.birth_year) : null)

// ── Profile form with a save bar ─────────────────────────────────────────────
interface ProfileForm {
  display_name: string
  username: string
  bio: string
  birth_year: number | null
  gender: Gender | null
  show_age: boolean
  show_gender: boolean
}

function fromProfile(p: Profile | null): ProfileForm {
  return {
    display_name: p?.display_name ?? '',
    username: p?.username ?? '',
    bio: p?.bio ?? '',
    birth_year: p?.birth_year ?? null,
    gender: p?.gender ?? null,
    show_age: p?.show_age ?? true,
    show_gender: p?.show_gender ?? true,
  }
}

const form = reactive<ProfileForm>(fromProfile(authStore.profile))
const saved = ref<ProfileForm>(fromProfile(authStore.profile))

const dirty = computed(() => (Object.keys(form) as (keyof ProfileForm)[]).some(k => form[k] !== saved.value[k]))
const usernameChanged = computed(() => form.username !== saved.value.username)
const canSave = computed(() =>
  !savingProfile.value
  && form.display_name.trim().length > 0
  && (!usernameChanged.value || availability.value === 'available'),
)

const savingProfile = ref(false)
const profileError = ref('')
const profileSuccess = ref('')

function onUsernameInput() {
  form.username = form.username.toLowerCase().replace(/[^a-z0-9_]/g, '')
  if (usernameChanged.value) checkUsername(form.username)
}

function discard() {
  Object.assign(form, saved.value)
  profileError.value = ''
}

async function saveProfile() {
  if (!canSave.value) return
  profileError.value = ''
  profileSuccess.value = ''
  savingProfile.value = true
  try {
    const updated = await authFetch<Profile>('/api/profile', {
      method: 'PATCH',
      body: {
        display_name: form.display_name,
        ...(usernameChanged.value ? { username: form.username } : {}),
        bio: form.bio,
        birth_year: form.birth_year,
        gender: form.gender,
        show_age: form.show_age,
        show_gender: form.show_gender,
      },
    })
    authStore.setProfile(updated)
    saved.value = fromProfile(updated)
    Object.assign(form, saved.value)
    profileSuccess.value = 'Saved.'
    setTimeout(() => { profileSuccess.value = '' }, 2500)
  }
  catch (err: unknown) {
    const e = err as { data?: { message?: string } }
    profileError.value = e?.data?.message ?? 'Could not save your profile'
  }
  finally {
    savingProfile.value = false
  }
}

// Leaving with unsaved edits asks first.
onBeforeRouteLeave(async () => {
  if (!dirty.value) return true
  return await confirm({
    title: 'Leave without saving?',
    message: 'Your profile changes are not saved yet.',
    confirmLabel: 'Leave',
    cancelLabel: 'Stay',
  })
})

// ── Photo ────────────────────────────────────────────────────────────────────
const savingAvatar = ref(false)
const avatarError = ref('')
const hasPhoto = computed(() => (authStore.profile?.avatar_url ?? '').startsWith('https://'))

async function persistAvatar(avatarUrl: string) {
  const updated = await authFetch<Profile>('/api/profile', { method: 'PATCH', body: { avatar_url: avatarUrl } })
  authStore.setProfile(updated)
}

async function handleAvatarUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  avatarError.value = ''
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    avatarError.value = 'Use a JPG, PNG or WebP image.'
    return
  }
  if (file.size > MAX_PHOTO_BYTES) {
    avatarError.value = 'That photo is over 5 MB.'
    return
  }

  savingAvatar.value = true
  try {
    await persistAvatar(await uploadAvatarPhoto(file))
  }
  catch (err: unknown) {
    const e = err as { data?: { message?: string }; message?: string }
    avatarError.value = e?.data?.message ?? e?.message ?? 'Could not upload the photo'
  }
  finally {
    savingAvatar.value = false
  }
}

async function removePhoto() {
  avatarError.value = ''
  savingAvatar.value = true
  try { await persistAvatar('') }
  catch { avatarError.value = 'Could not remove the photo' }
  finally { savingAvatar.value = false }
}

// ── Profile link ─────────────────────────────────────────────────────────────
const copiedLink = ref(false)
async function copyProfileLink() {
  const username = authStore.profile?.username
  if (!username) return
  await navigator.clipboard.writeText(`${window.location.origin}/user/${username}`)
  copiedLink.value = true
  setTimeout(() => { copiedLink.value = false }, 2000)
}

// ── Privacy (saved on toggle) ────────────────────────────────────────────────
const privacy = reactive({
  leaderboard_opt_out: authStore.profile?.leaderboard_opt_out ?? false,
  hide_from_search: authStore.profile?.hide_from_search ?? false,
  show_online_status: authStore.profile?.show_online_status ?? true,
})
const privacyError = ref('')

async function togglePrivacy(key: keyof typeof privacy) {
  privacyError.value = ''
  privacy[key] = !privacy[key]
  try {
    const updated = await authFetch<Profile>('/api/profile', { method: 'PATCH', body: { [key]: privacy[key] } })
    authStore.setProfile(updated)
    if (key === 'leaderboard_opt_out') {
      stats.value = await authFetch<ProfileStats>('/api/profile/stats').catch(() => stats.value)
    }
  }
  catch {
    privacy[key] = !privacy[key]
    privacyError.value = 'Could not save that change. Try again.'
  }
}

// ── Account ──────────────────────────────────────────────────────────────────
const trialEndLabel = computed(() => {
  const d = authStore.profile?.trial_ends_at
  return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : ''
})
const trialPercent = computed(() => Math.max(4, Math.min(100, (authStore.trialDays / TRIAL_DAYS) * 100)))

// TASK-126 — Stripe keeps a cancelled subscription active until the period
// ends; `cancel_at_period_end` is what tells the two apart.
const subscription = ref<Subscription | null>(null)
const cancelling = ref(false)
const cancelError = ref('')
const cancelSuccess = ref('')

const periodEndLabel = computed(() => {
  const d = subscription.value?.current_period_end
  return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null
})

const subscriptionLabel = computed(() => {
  if (!subscription.value?.cancel_at_period_end) return 'Active'
  return periodEndLabel.value ? `Active, cancels ${periodEndLabel.value}` : 'Active, cancels at period end'
})

onMounted(async () => {
  if (!authStore.isSubscribed) return
  try { subscription.value = await fetchStatus() }
  catch { /* falls back to plain Active */ }
})

async function cancelSubscriptionFlow() {
  cancelError.value = ''
  cancelSuccess.value = ''
  const ok = await confirm({
    title: 'Cancel your subscription?',
    message: periodEndLabel.value
      ? `You keep wearer features until ${periodEndLabel.value}, then your subscription ends. You can resubscribe any time.`
      : 'You keep wearer features until the end of the period you already paid for. You can resubscribe any time.',
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
    cancelError.value = e?.data?.message ?? e?.message ?? 'Could not cancel the subscription'
  }
  finally {
    cancelling.value = false
  }
}

const passwordForm = reactive({ password: '', confirm: '' })
const savingPassword = ref(false)
const passwordError = ref('')
const passwordSuccess = ref('')

async function changePassword() {
  passwordError.value = ''
  passwordSuccess.value = ''
  if (passwordForm.password.length < 8) { passwordError.value = 'Password must be at least 8 characters'; return }
  if (passwordForm.password !== passwordForm.confirm) { passwordError.value = 'Passwords do not match'; return }
  savingPassword.value = true
  try {
    await authFetch('/api/profile/change-password', { method: 'POST', body: { password: passwordForm.password } })
    passwordSuccess.value = 'Password updated.'
    passwordForm.password = ''
    passwordForm.confirm = ''
  }
  catch (err: unknown) {
    const e = err as { data?: { message?: string } }
    passwordError.value = e?.data?.message ?? 'Could not update the password'
  }
  finally {
    savingPassword.value = false
  }
}

// TASK-138 — the dialog asks why they are leaving; that answer is the only
// churn signal we get, and it doubles as one more deliberate step.
const deleting = ref(false)
const deleteError = ref('')
const deleteDialogOpen = ref(false)

function openDelete() {
  deleteError.value = ''
  deleteDialogOpen.value = true
}

async function confirmDelete({ reason, note, report }: {
  reason: string
  note: string
  report?: { kind: 'bug' | 'security'; message: string; allowContact: boolean }
}) {
  deleteError.value = ''
  deleting.value = true

  // TASK-176 — the report goes first: after deletion the server could no
  // longer tell who sent it. A failed report never blocks the deletion.
  if (report) {
    try {
      await authFetch('/api/security/report', {
        method: 'POST',
        body: { kind: report.kind, message: report.message, source: 'account_deletion', deletion_reason: reason, allow_contact: report.allowContact },
      })
    }
    catch (err) {
      console.warn('[delete account] report not sent:', err)
    }
  }

  try {
    await authFetch('/api/profile/delete', { method: 'POST', body: { reason, note } })
    saved.value = { ...form } // nothing left to save; skip the leave prompt
    await logout()
  }
  catch (err: unknown) {
    const e = err as { data?: { message?: string }; message?: string }
    deleteError.value = e?.data?.message ?? e?.message ?? 'Could not delete the account'
    deleting.value = false
    deleteDialogOpen.value = false
  }
}
</script>

<style lang="scss" scoped>
@use '~/assets/styles/shared-ui' as *;
@use '~/assets/styles/profile' as *;

.profile-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

.profile-wrap {
  width: 100%;
  max-width: 1100px;
  box-sizing: border-box;
  margin: 0 auto;
  padding: 24px 20px 120px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.hero-cam {
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-bg);
  border: 2px solid var(--color-surface);
  color: var(--color-text);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background 0.15s;

  &:hover { background: var(--color-elevated); }
  &--busy { opacity: 0.6; cursor: wait; }

  input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  svg { width: 17px; height: 17px; }
}

// ── Settings layout ──────────────────────────────────────────────────────────

.settings {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 28px;
  margin-top: 28px;
  align-items: start;

  &__menu {
    display: flex;
    flex-direction: column;
    gap: 4px;
    position: sticky;
    top: 20px;
  }

  &__tab {
    text-align: left;
    padding: 12px 14px;
    border-radius: 14px;
    border: 0;
    background: none;
    color: var(--color-text-muted);
    font: 600 15px var(--font-sans);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;

    &:hover { color: var(--color-text); }

    &--on {
      background: var(--color-surface);
      color: var(--color-text);
      box-shadow: inset 3px 0 0 var(--color-brand);
    }
  }

  &__tab-short { display: none; }
}

@media (max-width: 820px) {
  .settings {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    margin-top: 16px;

    &__menu {
      position: static;
      flex-direction: row;
      padding: 4px;
      border-radius: 999px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
    }

    &__tab {
      flex: 1;
      text-align: center;
      padding: 9px 0;
      border-radius: 999px;
      font-size: 13px;

      &--on { background: var(--color-elevated); box-shadow: none; }
    }

    &__tab-long { display: none; }
    &__tab-short { display: inline; }
  }

  .profile-wrap { padding: 16px 14px 120px; }
}

// ── Form parts ───────────────────────────────────────────────────────────────

.grid2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 18px;

  @media (max-width: 700px) { grid-template-columns: minmax(0, 1fr); }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-bottom: 20px;

  &__label { font-size: 13px; font-weight: 600; color: #CFC5F2; }

  &__input {
    height: 46px;
    box-sizing: border-box;
    border-radius: 14px;
    border: 1.5px solid var(--color-border);
    background: var(--color-bg);
    color: var(--color-text);
    padding: 0 14px;
    font: 16px var(--font-sans);
    transition: border-color 0.15s;

    &:focus { outline: none; border-color: var(--color-accent); }

    &--area { height: auto; padding: 12px 14px; resize: vertical; line-height: 1.5; }

    &--select {
      appearance: none;
      background: var(--color-bg) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23A99CD6' stroke-width='2' fill='none'/%3E%3C/svg%3E") no-repeat right 14px center;
      padding-right: 36px;
    }
  }

  &__hint { font-size: 12px; color: var(--color-text-muted); }
  &__hint--right { text-align: right; }
}

.uname {
  display: flex;
  align-items: center;
  border: 1.5px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-bg);
  overflow: hidden;
  transition: border-color 0.15s;

  &:focus-within { border-color: var(--color-accent); }
  &--available { border-color: var(--color-success); }
  &--taken, &--invalid { border-color: var(--color-danger); }

  span { padding-left: 14px; color: var(--color-text-muted); font-size: 14px; white-space: nowrap; }

  input {
    flex: 1;
    min-width: 0;
    height: 43px;
    border: 0;
    background: none;
    color: var(--color-text);
    font: 16px var(--font-sans);
    padding: 0 12px 0 2px;
    outline: none;
  }
}

.photo {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 16px;
  margin-bottom: 24px;
  border: 1.5px dashed var(--color-border);
  border-radius: 18px;

  &__avatar { width: 72px; height: 72px; border-radius: 50%; flex-shrink: 0; }

  &__text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;

    span { font-size: 13px; color: var(--color-text-muted); line-height: 1.45; }
  }

  &__actions { display: flex; gap: 8px; flex-wrap: wrap; }

  label.pbtn { position: relative; }

  @media (max-width: 560px) {
    flex-wrap: wrap;

    &__actions { width: 100%; }
  }
}

.pbtn--busy { opacity: 0.6; cursor: wait; }

.sep { height: 1px; background: var(--color-border); margin: 6px 0 22px; }

.subhead {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;

  h3 { margin: 0; font-family: var(--font-display); font-size: 17px; }
  span { font-size: 12px; color: var(--color-text-muted); }
}

.chips { display: flex; gap: 8px; flex-wrap: wrap; }

.chip {
  padding: 9px 14px;
  border-radius: 999px;
  border: 1.5px solid var(--color-border);
  background: none;
  color: #CFC5F2;
  font: 500 14px var(--font-sans);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  &:hover { border-color: var(--color-elevated); }

  &--on {
    border-color: var(--color-brand);
    background: rgba(var(--color-brand-rgb), 0.14);
    color: var(--color-text);
  }
}

.vis {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  align-self: flex-start;
  margin-top: 2px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-text-muted);
  font: 13px var(--font-sans);
  cursor: pointer;

  &:disabled { opacity: 0.5; cursor: default; }
}

.toggle--mini {
  width: 34px;
  height: 20px;

  .toggle__knob { width: 14px; height: 14px; }

  &.toggle--on .toggle__knob { transform: translateX(14px); }
}

.msg {
  margin: 8px 0 0;
  font-size: 14px;

  &--error { color: var(--color-danger); }
  &--ok { color: var(--color-success); }
}

// ── Privacy rows ─────────────────────────────────────────────────────────────

.trow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 0;
  border-top: 1px solid var(--color-border);

  &:first-of-type { border-top: 0; padding-top: 0; }

  &__label { font-weight: 600; }
  &__hint { margin: 4px 0 0; font-size: 13px; color: var(--color-text-muted); line-height: 1.5; max-width: 520px; }
}

// ── Account ──────────────────────────────────────────────────────────────────

.email { color: var(--color-text); overflow-wrap: anywhere; }

.plan {
  padding: 18px 20px;
  margin-bottom: 18px;
  border-radius: 18px;
  background: linear-gradient(120deg, rgba(var(--color-brand-rgb), 0.14), rgba(var(--color-cta-rgb), 0.1));
  border: 1px solid rgba(var(--color-brand-rgb), 0.35);

  &--over { background: var(--color-bg); border-color: var(--color-border); }

  &__top { display: flex; justify-content: space-between; gap: 12px; font-weight: 600; }

  &__bar {
    height: 8px;
    margin: 12px 0 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;

    i { display: block; height: 100%; border-radius: 999px; background: var(--gradient-brand); }
  }

  &__note { display: block; margin-top: 6px; font-size: 13px; color: var(--color-text-muted); }
}

.arow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 0;
  border-top: 1px solid var(--color-border);

  &__text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  &__title { font-weight: 600; }
  &__hint { font-size: 13px; color: var(--color-text-muted); }
}

.acc {
  border-top: 1px solid var(--color-border);

  &__trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 0;
    cursor: pointer;
    list-style: none;

    &::-webkit-details-marker { display: none; }
  }

  &__chev { color: var(--color-text-muted); transition: transform 0.2s; }
  &[open] &__chev { transform: rotate(180deg); }

  &__body { padding: 0 0 16px; }

  &__note { margin: 0 0 14px; font-size: 14px; color: var(--color-text-muted); line-height: 1.55; }

  &__foot { display: flex; align-items: center; justify-content: flex-end; gap: 12px; flex-wrap: wrap; }
}

.danger {
  margin-top: 22px;
  padding: 4px 18px;
  border-radius: 18px;
  border: 1px solid rgba(var(--color-danger-rgb), 0.35);

  &__title {
    margin: 14px 0 0;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-danger);
  }

  .acc { border-top: 0; }
}

// ── Save bar ─────────────────────────────────────────────────────────────────

.savebar {
  position: fixed;
  left: 50%;
  bottom: calc(22px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  // Above the cookie and install banners (9999 / 9998), which sit in the
  // same spot: unsaved changes matter more than a prompt that can wait.
  z-index: 10000;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px 8px 20px;
  border-radius: 999px;
  background: #241078;
  border: 1px solid var(--color-elevated);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  max-width: calc(100vw - 28px);
  box-sizing: border-box;

  &__text {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-right: 6px;
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;

    i { width: 8px; height: 8px; border-radius: 50%; background: var(--color-cta); }
  }
}

.savebar-enter-active, .savebar-leave-active { transition: opacity 0.2s, transform 0.2s; }
.savebar-enter-from, .savebar-leave-to { opacity: 0; transform: translate(-50%, 16px); }
</style>
