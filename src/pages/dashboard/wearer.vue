<template>
  <div class="dash">

    <AppNav />

    <!-- Loading -->
    <div v-if="initialising" class="dash-state">
      <div class="spinner" />
    </div>

    <!-- No loq -->
    <div v-else-if="!loq" class="dash-state">
      <!-- Subscription gate (TASK-056): loqee needs premium access (paid
           subscription or running free trial, migration 001) to create a loq -->
      <template v-if="!authStore.hasAccess">
        <div class="dash-state__icon"><img :src="subscribeIcon" class="state-icon" alt="" width="128" height="128" decoding="async"></div>
        <p class="dash-state__title">
          {{ subscriptionEnded ? 'Your subscription has ended' : trialEnded ? 'Your free trial has ended' : 'Start your first lock' }}
        </p>
        <p class="dash-state__hint">
          {{ subscriptionEnded
            ? 'Resubscribe to create a new lock. Browsing keyholders stays free.'
            : trialEnded
              ? 'Paid plans are coming soon. Browsing keyholders stays free.'
              : 'A subscription unlocks lock creation. You can still browse keyholders for free.' }}
        </p>
        <NuxtLink to="/subscription/upgrade" class="btn btn--primary">
          {{ subscriptionEnded ? 'Resubscribe' : trialEnded ? 'See plans' : 'Subscribe to start your first lock' }}
        </NuxtLink>
      </template>

      <template v-else>
        <div class="dash-state__icon"><img :src="unloqedIcon" class="state-icon" alt="" width="128" height="128" decoding="async"></div>
        <p class="dash-state__title">You're free</p>
        <p class="dash-state__hint">Ready to be locked? Create a lock and find a keyholder.</p>
        <p v-if="authStore.isOnTrial" class="dash-state__trial">
          Free trial · {{ authStore.trialDays }} {{ authStore.trialDays === 1 ? 'day' : 'days' }} left
        </p>
        <NuxtLink to="/lock/create" class="btn btn--primary">Create Lock</NuxtLink>
      </template>
    </div>

    <!-- Draft / Request -->
    <div v-else-if="loq.status === 'draft' || loq.status === 'pending'" class="dash-body">
      <div class="dash-header">
        <div class="dash-header__text">
          <h1 class="dash-header__title">Your Lock</h1>
          <p class="dash-header__sub">Your clock is running. Find a keyholder to take control.</p>
        </div>
      </div>

      <article class="loq-card" :class="loq.status === 'pending' ? 'loq-card--request' : 'loq-card--draft'">

        <!-- Summary row -->
        <div class="loq-card__summary">
          <div class="loq-card__identity">
            <UserAvatar class="loq-card__avatar" :avatar-url="authStore.profile?.avatar_url" :display-name="authStore.profile?.display_name" />
            <div>
              <p class="loq-card__name">Your Lock</p>
              <p class="loq-card__since">
                {{ formatDuration(loq.duration_minutes) }} · {{ timeAgo(loq.created_at) }}<template v-if="loq.emotion"> · {{ emotionEmoji(loq.emotion) }} {{ loq.emotion }}</template>
              </p>
            </div>
          </div>

          <LockCountdown
            class="loq-card__hero-timer"
            hero
            :expanded="true"
            :locked-until="loq.loqed_until"
            @expired="onExpired"
          />

          <div class="loq-card__summary-meta">
            <span v-if="loq.is_public" class="loq-status-pill loq-status-pill--public">PUBLIC</span>
            <!-- TASK-086: a 'draft' loq's clock has been running since
                 creation (TASK-062) regardless of pairing status — "DRAFT"
                 wrongly implied it hadn't started. Only 'pending' (a
                 request sent to a specific loqholder) still gets its own
                 label; everything else that reaches this branch is active. -->
            <span class="loq-status-pill" :class="loq.status === 'pending' ? 'loq-status-pill--request' : 'loq-status-pill--active'">
              <span class="loq-status-pill__dot" />
              {{ loq.status === 'pending' ? 'REQUEST' : 'ACTIVE' }}
            </span>
          </div>
        </div>

        <!-- Always-visible detail -->
        <div class="loq-card__detail">

          <div v-if="loq.reason" class="reason-wrap">
            <p class="card-reason">"{{ loq.reason }}"</p>
          </div>

          <div class="incoming-wrap">
            <span class="incoming__count">{{ loq.pending_requests ?? 0 }}</span>
            <span class="incoming__label">incoming request{{ (loq.pending_requests ?? 0) !== 1 ? 's' : '' }}</span>
          </div>

          <!-- TASK-087: public loq — the pending request is a loqholder
               asking to join. The loqee reviews and decides, instead of
               whoever clicks fastest getting it. -->
          <p v-if="loq.is_public && loq.pending_request" class="incoming-request-who">
            <strong>{{ loq.pending_request.loqholder.display_name ?? 'A keyholder' }}</strong> wants to be your keyholder
          </p>

          <!-- Nudge when the loq is stuck: not public and no requests yet -->
          <div v-if="!loq.is_public && (loq.pending_requests ?? 0) === 0" class="publish-nudge">
            <svg class="publish-nudge__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="4.5" /><path d="M11.2 11.2 20 20" /><path d="m16 16 2-2" /><path d="m18.5 18.5 2-2" /></svg>
            <p class="publish-nudge__text">No requests yet. Drop your key in Key Drop to reach more keyholders.</p>
          </div>

          <div class="loq-card__actions">
            <template v-if="loq.is_public && loq.pending_request">
              <button
                class="loq-act loq-act--outline"
                :disabled="requestActionPending"
                @click="handleRejectIncoming"
              >Reject</button>
              <button
                class="loq-act loq-act--primary"
                :disabled="requestActionPending"
                @click="handleApproveIncoming"
              >{{ requestActionPending ? 'Approving…' : 'Accept keyholder' }}</button>
            </template>
            <!-- TASK-057: one pending request at a time -->
            <button
              v-else-if="(loq.pending_requests ?? 0) > 0"
              class="loq-act loq-act--outline"
              :disabled="cancellingRequest"
              @click="handleCancelRequest"
            >{{ cancellingRequest ? 'Cancelling…' : 'Cancel request' }}</button>
            <NuxtLink v-else :to="`/lock/${loq.id}/find-keyholder`" class="loq-act loq-act--ghost">
              {{ loq.status === 'pending' ? 'Choose another keyholder' : 'Find a Keyholder' }}
            </NuxtLink>
            <button
              v-if="!loq.is_public"
              class="loq-act loq-act--primary"
              :disabled="publishing"
              @click="handlePublish"
            >{{ publishing ? 'Publishing…' : 'Drop your key' }}</button>
            <button
              v-else
              class="loq-act loq-act--outline"
              :disabled="unpublishing"
              @click="handleUnpublish"
            >{{ unpublishing ? 'Removing…' : 'Take your key back' }}</button>
            <button class="loq-act loq-act--end" :disabled="cancelling" @click="handleCancel">
              {{ cancelling ? 'Cancelling…' : 'Cancel' }}
            </button>
          </div>

          <p class="loq-card__hint">
            <template v-if="loq.status === 'draft'">
              Your clock is already running. Drop your key in
              <NuxtLink to="/keydrop" class="loq-card__link">Key Drop</NuxtLink>
              or ask a specific keyholder to take control.
            </template>
            <template v-else>
              Your clock is running. Waiting for a keyholder to accept and take control.
              <NuxtLink v-if="loq.listed_in_discover" to="/keydrop" class="loq-card__link">See it in Key Drop →</NuxtLink>
            </template>
          </p>

          <p v-if="actionError" class="loq-card__error">{{ actionError }}</p>
        </div>
      </article>
    </div>

    <!-- Ended / Cancelled -->
    <div v-else-if="loq.status === 'ended' || loq.status === 'cancelled'" class="dash-state">
      <div class="dash-state__icon"><img :src="unloqedIcon" class="state-icon" alt="" width="128" height="128" decoding="async"></div>
      <p class="dash-state__title">You're free!</p>
      <p class="dash-state__hint">{{ loq.status === 'cancelled' ? 'You cancelled the lock.' : 'Your keyholder has ended the lock.' }}</p>
      <div v-if="loq.combination_text" class="combo-reveal">
        <p class="combo-reveal__label">Your combination</p>
        <div class="combo-reveal__row">
          <code class="combo-reveal__value">{{ loq.combination_text }}</code>
          <button class="btn btn--ghost btn--sm" @click="copyCombination">
            {{ copiedCombo ? 'Copied' : 'Copy' }}
          </button>
        </div>
      </div>
      <div v-else-if="loq.combination_photo_url" class="combo-reveal combo-reveal--photo">
        <p class="combo-reveal__label">Your combination</p>
        <button type="button" class="combo-reveal__photo-btn" @click="lightboxOpen = true">
          <img :src="loq.combination_photo_url" alt="Your lock combination" class="combo-reveal__photo" />
          <span class="combo-reveal__expand">⤢ Click to enlarge</span>
        </button>
      </div>
      <LoqFinalCard v-if="loq.status === 'ended'" :loq-id="loq.id" />
      <NuxtLink to="/locks/history" class="btn btn--ghost">See the history of this lock</NuxtLink>
      <button class="btn btn--primary" @click="handleContinue">Continue</button>

      <ImageLightbox
        v-if="lightboxOpen && loq.combination_photo_url"
        :src="loq.combination_photo_url"
        alt="Your lock combination"
        @close="lightboxOpen = false"
      />
    </div>

    <!-- Active / Paused -->
    <div v-else-if="loq.status === 'active' || loq.status === 'paused'" class="dash-body">
      <div class="dash-header">
        <div class="dash-header__text">
          <h1 class="dash-header__title">Your Lock</h1>
          <p class="dash-header__sub">
            {{ loq.status === 'paused' ? (isSelfLoq ? 'Paused' : 'Paused by your keyholder') : (isSelfLoq ? "You're locking yourself" : "You're locked") }}
          </p>
        </div>
      </div>

      <Transition name="visitor-flash">
        <p v-if="visitorFlash" class="visitor-flash">{{ visitorFlash }}</p>
      </Transition>

      <LoqMilestone :loq-id="loq.id" />

      <article class="loq-card" :class="loq.status === 'paused' ? 'loq-card--paused' : 'loq-card--active'">

        <!-- Summary row -->
        <div class="loq-card__summary">
          <div v-if="isSelfLoq" class="loq-card__identity">
            <div class="loq-card__self-icon" aria-hidden="true"><img :src="loqedIcon" class="state-icon" alt="" width="128" height="128" decoding="async"></div>
            <div>
              <p class="loq-card__name">Self-lock</p>
              <p class="loq-card__since">No keyholder. You're in control.</p>
            </div>
          </div>
          <div v-else class="loq-card__identity">
            <UserAvatar class="loq-card__avatar" :avatar-url="loq.loqholder?.avatar_url" :display-name="loq.loqholder?.display_name" />
            <div>
              <p class="loq-card__name">{{ loq.loqholder?.display_name ?? 'Your keyholder' }}</p>
              <p class="loq-card__since">{{ timeAgo(loq.accepted_at) }}</p>
              <OnlineIndicator :user-id="loq.loqholder?.id" :last-seen-at="loq.loqholder?.last_seen_at" />
            </div>
          </div>

          <LockCountdown
            class="loq-card__hero-timer"
            hero
            :expanded="true"
            :locked-until="loq.loqed_until"
            :paused-at="loq.paused_at"
            @expired="onExpired"
          />

          <div class="loq-card__summary-meta">
            <span class="loq-status-pill" :class="loq.status === 'paused' ? 'loq-status-pill--paused' : 'loq-status-pill--active'">
              <span class="loq-status-pill__dot" />
              {{ loq.status === 'paused' ? 'PAUSED' : 'ACTIVE' }}
            </span>
          </div>
        </div>

        <!-- Detail (always visible) -->
        <div class="loq-card__detail">

          <div v-if="loq.status === 'paused'" class="paused-banner">{{ isSelfLoq ? 'Paused' : 'Paused by your keyholder' }}</div>

          <div class="mood-wrap">
            <LoqEmotionPicker
              :model-value="currentEmotion"
              :loq-id="loq.id"
              @update:model-value="onEmotionPicked"
            />
          </div>

          <!-- Self-loq: same self-service controls a loqholder would have -->
          <template v-if="isSelfLoq">
            <div class="loq-card__actions">
              <button
                class="loq-act loq-act--outline"
                :disabled="selfActionPending"
                @click="handleSelfPauseToggle"
              >{{ loq.status === 'paused' ? 'Resume' : 'Pause' }}</button>
              <button
                class="loq-act loq-act--end"
                :disabled="selfActionPending"
                @click="handleSelfEnd"
              >End</button>
            </div>

            <div v-if="loq.public_link_id" class="visitor-link-wrap">
              <div class="visitor-link">
                <code class="visitor-link__url">{{ visitorLinkUrl }}</code>
                <button class="visitor-link__copy" :class="{ 'visitor-link__copy--done': copiedVisitorLink }" @click="copySelfVisitorLink">
                  {{ copiedVisitorLink ? 'Copied' : 'Copy' }}
                </button>
              </div>
              <p class="visitor-count">{{ loq.visitor_count ?? 0 }} visitor{{ (loq.visitor_count ?? 0) !== 1 ? 's' : '' }} interacted</p>
            </div>
          </template>

          <!-- TASK-142 — listing and vote permissions, for any loq of yours
               that no loqholder has taken. Once one does, the clock is
               theirs and the loq leaves Discover. -->
          <LoqDiscoverControls
            v-if="!loq.loqholder_id && ['pending', 'active', 'paused'].includes(loq.status)"
            :loq="loq"
            @updated="applyLoqPatch"
            @error="actionError = $event"
          />

          <LoqChat v-else :loq-id="loq.id" :channel="loqChannel" />

          <LoqCheckin :loq-id="loq.id" role="wearer" />
          <LoqVerification :loq-id="loq.id" role="wearer" />
          <LoqTasks :loq-id="loq.id" role="wearer" />
          <LoqWheel :loq-id="loq.id" role="wearer" />
          <LoqHistory :loq-id="loq.id" />

          <p v-if="actionError" class="loq-card__error">{{ actionError }}</p>
        </div>
      </article>
    </div>

  </div>
</template>

<script setup lang="ts">
// TASK-151 — these emoji were the page's only visual state cue, and each
// one renders differently on every platform the app runs on.
import loqedIcon from '~/assets/images/icons/state-loqed.webp'
import unloqedIcon from '~/assets/images/icons/state-unloqed.webp'
import subscribeIcon from '~/assets/images/icons/state-subscribe.webp'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Loq } from '~/types'

definePageMeta({ middleware: 'auth' })

interface LoqholderProfile { id: string; display_name: string | null; avatar_url: string | null; last_seen_at?: string | null }
type ActiveLoq = Loq & { loqholder?: LoqholderProfile | null }

const authStore = useAuthStore()
const {
  fetchCurrentLoq, cancelLoq, acknowledgeCombination, cancelRequest, publishLoq, unpublishLoq,
  pauseLoq, endLoq, approveRequest, rejectIncomingRequest,
} = useLoq()

const { fetchStatus } = useSubscription()
const { $supabase } = useNuxtApp()
const { authFetch } = useAuthFetch()
const { confirm } = useConfirm()

const initialising = ref(true)
const loq = ref<ActiveLoq | null>(null)

// TASK-056 — subscription gate CTA. `inactive` covers both "never subscribed"
// and "subscription ended"; a lingering subscription row disambiguates so we
// can show the right copy on the no-loq state.
const subscriptionEnded = ref(false)
// Had a trial (every account gets one, migration 001) and it ran out.
const trialEnded = computed(() => !!authStore.profile?.trial_ends_at && !authStore.hasAccess)

const cancelling = ref(false)
const cancellingRequest = ref(false)
const requestActionPending = ref(false)
const publishing = ref(false)
const unpublishing = ref(false)
const actionError = ref('')
const copiedCombo = ref(false)
const lightboxOpen = ref(false)
const currentEmotion = ref<string | null>(null)
const visitorFlash = ref('')
let visitorFlashTimer: ReturnType<typeof setTimeout> | null = null


let loqChannel: RealtimeChannel | null = null

// ─── Init ──────────────────────────────────────────────────────────────────

onMounted(async () => {
  if (import.meta.client) window.addEventListener('online', handleReconnect)
  try {
    loq.value = await fetchCurrentLoq()
    if (loq.value?.emotion) currentEmotion.value = loq.value.emotion

    if (loq.value && (loq.value.status === 'active' || loq.value.status === 'paused')) {
      subscribeToLoq(loq.value.id)
    }
    else if (loq.value && (loq.value.status === 'draft' || loq.value.status === 'pending')) {
      subscribeToLoq(loq.value.id)
    }

    // No loq + not subscribed: a leftover subscription row means it ended
    // (vs. a brand-new loqee who never subscribed).
    if (!loq.value && !authStore.hasAccess) {
      const sub = await fetchStatus().catch(() => null)
      subscriptionEnded.value = !!sub
    }
  }
  finally {
    initialising.value = false
  }
})

onUnmounted(() => {
  loqChannel?.unsubscribe()
  if (visitorFlashTimer) clearTimeout(visitorFlashTimer)
  if (import.meta.client) window.removeEventListener('online', handleReconnect)
})

async function handleReconnect() {
  if (!loq.value) return
  loqChannel?.unsubscribe(); loqChannel = null
  subscribeToLoq(loq.value.id)
}

// ─── Realtime ──────────────────────────────────────────────────────────────

function subscribeToLoq(loqId: string) {
  loqChannel = $supabase
    .channel(`loq:${loqId}`)
    .on('broadcast', { event: 'loq_updated' }, async (payload: { payload: { loq: ActiveLoq & { incoming_request?: boolean }; loqholder?: LoqholderProfile | null } }) => {
      const { loq: updated, loqholder } = payload.payload
      // TASK-102 — a fresh draft/pending -> active transition (the loqee's
      // private request just got accepted) needs the accepting loqholder's
      // joined profile, same reason 'ended'/incoming_request re-fetch
      // instead of merging. Guarded so it doesn't also fire on every
      // already-active broadcast (e.g. pause.post.ts's resume, which sets
      // status: 'active' too but has nothing new to join).
      const justBecameActive = updated.status === 'active' && loq.value?.status !== 'active'
      if (updated.status === 'ended' || updated.incoming_request || justBecameActive) {
        loq.value = await fetchCurrentLoq()
        return
      }
      loq.value = { ...loq.value, ...updated, loqholder: loqholder ?? loq.value?.loqholder ?? null } as ActiveLoq
      if (updated.emotion) currentEmotion.value = updated.emotion as string
    })
    // TASK-065: the countdown itself updates via the broadcast above
    // (adjust-time.post.ts still calls broadcastLoqUpdate) — this only
    // adds the "a visitor changed your time" notification on top.
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'loq_visitor_interactions', filter: `loq_id=eq.${loqId}` },
      (payload: { new: { direction: 'add' | 'remove'; hours_added: number } }) => {
        const { direction, hours_added } = payload.new
        if (visitorFlashTimer) clearTimeout(visitorFlashTimer)
        visitorFlash.value = `A visitor ${direction === 'remove' ? 'removed' : 'added'} ${hours_added}h`
        visitorFlashTimer = setTimeout(() => { visitorFlash.value = '' }, 4000)
      },
    )
    .subscribe()
}

function onEmotionPicked(emotion: string) {
  currentEmotion.value = emotion
  loqChannel?.send({ type: 'broadcast', event: 'loq_updated', payload: { loq: { emotion } } })
}

// ─── Actions ───────────────────────────────────────────────────────────────

async function handleCancel() {
  if (!loq.value) return
  const ok = await confirm({
    title: 'Cancel this lock?',
    message: 'Your lock will be removed and any pending requests dropped. This can’t be undone.',
    confirmLabel: 'Cancel lock',
    cancelLabel: 'Keep it',
    danger: true,
  })
  if (!ok) return
  cancelling.value = true
  actionError.value = ''
  try {
    // Re-fetches instead of clearing — the loqee lands on the reveal state
    // (combination text/photo) rather than losing it (TASK-084).
    loq.value = await cancelLoq(loq.value.id)
    loqChannel?.unsubscribe()
    loqChannel = null
  }
  catch (err) { actionError.value = (err as Error).message }
  finally { cancelling.value = false }
}

// TASK-084 — mark the combination as seen so it doesn't resurface on the
// next load, then return to the empty dashboard state.
async function handleContinue() {
  if (loq.value?.id && (loq.value.status === 'ended' || loq.value.status === 'cancelled')) {
    // Silent catch was hiding real failures here — if this call fails, the
    // loq stays unacknowledged and resurfaces on the next dashboard load
    // (TASK-096). Not surfaced to the user (Continue should never feel
    // blocked), but at least logged so it isn't invisible.
    await acknowledgeCombination(loq.value.id).catch(err => console.error('[wearer] Failed to acknowledge combination:', err))
  }
  loq.value = null
}

// TASK-057 — withdraw the single pending request so the loqee can choose a
// different loqholder. Re-fetch to refresh pending_requests.
async function handleCancelRequest() {
  if (!loq.value) return
  cancellingRequest.value = true
  actionError.value = ''
  try {
    await cancelRequest(loq.value.id)
    loq.value = await fetchCurrentLoq()
  }
  catch (err) { actionError.value = (err as Error).message }
  finally { cancellingRequest.value = false }
}

// TASK-087 — loqee approves/rejects a loqholder's request to join their
// public loq.
async function handleApproveIncoming() {
  if (!loq.value) return
  requestActionPending.value = true
  actionError.value = ''
  try {
    loq.value = await approveRequest(loq.value.id)
  }
  catch (err) { actionError.value = (err as Error).message }
  finally { requestActionPending.value = false }
}

async function handleRejectIncoming() {
  if (!loq.value) return
  requestActionPending.value = true
  actionError.value = ''
  try {
    await rejectIncomingRequest(loq.value.id)
    loq.value = await fetchCurrentLoq()
  }
  catch (err) { actionError.value = (err as Error).message }
  finally { requestActionPending.value = false }
}

async function copyCombination() {
  const text = loq.value?.combination_text
  if (!text) return
  await navigator.clipboard.writeText(text)
  copiedCombo.value = true
  setTimeout(() => { copiedCombo.value = false }, 2000)
}

// ── Self-loq (TASK-058) ────────────────────────────────────────────────────
// A self-loq has no loqholder — the loqee gets the same pause/end/share-link
// controls a loqholder would normally have on a paired loq.

const isSelfLoq = computed(() => !loq.value?.loqholder_id)
const selfActionPending = ref(false)
const copiedVisitorLink = ref(false)
// TASK-142 — LoqDiscoverControls owns the visitor settings now and reports
// back what changed, so the card re-renders without a refetch.
function applyLoqPatch(patch: Partial<Loq>) {
  if (!loq.value) return
  loq.value = { ...loq.value, ...patch }
}

const visitorLinkUrl = computed(() => {
  if (!loq.value?.public_link_id || !import.meta.client) return ''
  return `${window.location.origin}/lock/${loq.value.public_link_id}`
})

async function handleSelfPauseToggle() {
  if (!loq.value) return
  // TASK-104 — pausing a self-loq costs a 5-minute penalty (server-side),
  // so confirm before pausing. Resuming needs no confirmation.
  if (loq.value.status === 'active') {
    const ok = await confirm({
      title: 'Pause this lock?',
      message: 'Pausing = 5 minute penalty. Are you sure you want to pause?',
      confirmLabel: 'Pause anyway',
      cancelLabel: 'Keep going',
      danger: true,
    })
    if (!ok) return
  }
  selfActionPending.value = true
  actionError.value = ''
  try {
    loq.value = await pauseLoq(loq.value.id)
  }
  catch (err) { actionError.value = (err as Error).message }
  finally { selfActionPending.value = false }
}

async function handleSelfEnd() {
  if (!loq.value) return
  selfActionPending.value = true
  actionError.value = ''
  try {
    loq.value = await endLoq(loq.value.id)
    loqChannel?.unsubscribe()
    loqChannel = null
  }
  catch (err) { actionError.value = (err as Error).message }
  finally { selfActionPending.value = false }
}

async function copySelfVisitorLink() {
  if (!visitorLinkUrl.value) return
  await navigator.clipboard.writeText(visitorLinkUrl.value)
  copiedVisitorLink.value = true
  setTimeout(() => { copiedVisitorLink.value = false }, 2000)
}


async function handlePublish() {
  if (!loq.value) return
  publishing.value = true
  actionError.value = ''
  try {
    loq.value = await publishLoq(loq.value.id)
  }
  catch (err) { actionError.value = (err as Error).message }
  finally { publishing.value = false }
}

async function handleUnpublish() {
  if (!loq.value) return
  unpublishing.value = true
  actionError.value = ''
  try {
    loq.value = await unpublishLoq(loq.value.id)
  }
  catch (err) { actionError.value = (err as Error).message }
  finally { unpublishing.value = false }
}

async function onExpired() {
  if (!loq.value) return
  loq.value = await fetchCurrentLoq()
}

// timeAgo / formatDuration / emotionEmoji come from composables/useLoqFormat.ts
</script>

<style scoped lang="scss">
@use '~/assets/styles/loq-card' as *;
@use '~/assets/styles/shared-ui' as *;

// ── Loq card: page-specific layout ───────────────────────────────────────────
// Shared card/pill/spinner/etc. styles come from assets/styles/_loq-card.scss

.loq-card {
  // Summary: identity + status on the first row, the timer full width below.
  &__summary {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 20px 12px;

    .loq-card__identity     { grid-column: 1; grid-row: 1; }
    .loq-card__summary-meta { grid-column: 2; grid-row: 1; }
    .loq-card__hero-timer   { grid-column: 1 / -1; grid-row: 2; }
  }

  // Detail is always visible on this page: permanent separator
  &__detail {
    padding-top: 20px;
    border-top: 1px solid var(--color-border);
  }
}

// ── Field groups ──────────────────────────────────────────────────────────────

.incoming-wrap {
  @include field-group('Incoming requests');
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.incoming {
  &__count {
    font-size: 1.75rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--color-accent);
    line-height: 1;
  }

  &__label {
    font-size: 0.8125rem;
    color: var(--color-muted);
  }
}

.loq-card--request .incoming__count { color: var(--color-warn); }

.incoming-request-who {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text);

  strong { color: var(--color-accent); }
}

// ── Publish nudge (stuck pending state) ──────────────────────────────────────

.publish-nudge {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 0.75rem;
  border-radius: 0.75rem;
  background: rgba(var(--color-accent-rgb), 0.08);
  border: 1px solid rgba(var(--color-accent-rgb), 0.25);

  &__icon { width: 22px; height: 22px; flex-shrink: 0; color: var(--color-cta); }

  &__text {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--color-text);
  }
}

// ── Action buttons (page-specific modifiers) ─────────────────────────────────

.loq-act {
  &--ghost {
    flex: 1;
    &:hover:not(:disabled) {
      border-color: var(--color-accent);
      color: var(--color-text);
      background: rgba(var(--color-accent-rgb), 0.08);
    }
  }

  &--primary {
    flex: 1;
    background: var(--color-cta);
    color: var(--color-on-accent);
    border-color: var(--color-cta);
    font-weight: 700;
    box-shadow: 0 8px 24px rgba(var(--color-cta-rgb), 0.3);
    &:hover:not(:disabled) { border-color: var(--color-cta); filter: brightness(1.06); }
  }

  &--outline {
    flex: 1;
    border-color: rgba(var(--color-accent-rgb), 0.6);
    color: var(--color-text);
    background: rgba(var(--color-accent-rgb), 0.08);
    &:hover:not(:disabled) { border-color: var(--color-accent); background: rgba(var(--color-accent-rgb), 0.15); }
  }
}

// ── Self-loq (TASK-058) ────────────────────────────────────────────────────

.loq-card__self-icon {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  background: rgba(var(--color-accent-rgb), 0.12);
  flex-shrink: 0;
}

.visitor-link-wrap {
  @include field-group('Visitor link');
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.visitor-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.5rem 0.5rem 0.75rem;
  border-radius: 0.625rem;
  background: var(--color-bg);
  border: 1px solid var(--color-border);

  &__url {
    flex: 1;
    min-width: 0;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__copy {
    flex-shrink: 0;
    min-height: 1.875rem;
    padding: 0 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-muted);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, color 0.12s;

    &:hover { border-color: var(--color-accent); color: var(--color-accent); }

    &--done {
      border-color: rgba(34, 197, 94, 0.4);
      color: #22c55e;
      background: rgba(34, 197, 94, 0.08);
    }
  }
}

.visitor-amount {
  &__caption {
    font-size: 0.75rem;
    color: var(--color-muted);
    margin: 0 0 0.375rem;
  }
}

.visitor-count {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.combo-toggle {
  display: flex;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-sm, 0.5rem);
  overflow: hidden;
  width: fit-content;

  &__btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    background: none;
    border: none;
    color: var(--color-muted);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;

    &:disabled { opacity: 0.5; cursor: not-allowed; }
    & + & { border-left: 1.5px solid var(--color-border); }

    &--active {
      background: var(--color-accent);
      color: var(--color-on-accent);
    }
  }
}

// ── Combination reveal (ended state) ──────────────────────────────────────

.combo-reveal {
  width: 100%;
  max-width: 360px;
  background: rgba(var(--color-accent-rgb), 0.08);
  border: 1px solid rgba(var(--color-accent-rgb), 0.35);
  border-radius: 0.875rem;
  padding: 1rem 1.125rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  text-align: left;
  animation: combo-reveal-in 0.5s cubic-bezier(0.16, 1, 0.3, 1);

  &__label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
    color: var(--color-accent);
    margin: 0;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  &__value {
    flex: 1;
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text);
    word-break: break-all;
    text-shadow: 0 0 16px rgba(var(--color-accent-rgb), 0.35);
  }

  &--photo {
    max-width: 360px;

    // Bigger on web — mobile keeps the compact card, desktop gets a much
    // larger preview since there's room for it (client feedback).
    @media (min-width: 640px) {
      max-width: 560px;
    }
  }

  &__photo-btn {
    position: relative;
    display: block;
    width: 100%;
    padding: 0;
    border: none;
    background: none;
    cursor: zoom-in;
    border-radius: 0.625rem;
    overflow: hidden;

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }

    &:hover .combo-reveal__expand,
    &:focus-visible .combo-reveal__expand {
      opacity: 1;
    }
  }

  &__photo {
    display: block;
    width: 100%;
    max-height: 360px;
    object-fit: contain;
    border-radius: 0.625rem;
    background: rgba(0, 0, 0, 0.2);

    @media (min-width: 640px) {
      max-height: 520px;
    }
  }

  &__expand {
    position: absolute;
    inset: auto 0 0 0;
    padding: 0.5rem;
    font-size: 0.75rem;
    color: #fff;
    text-align: center;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.65), transparent);
    opacity: 0;
    transition: opacity 0.15s;
    pointer-events: none;

    // No hover on touch devices — show the affordance always so it's
    // discoverable without a hover state that'll never happen.
    @media (hover: none) {
      opacity: 1;
    }
  }
}

@keyframes combo-reveal-in {
  from { opacity: 0; transform: translateY(10px) scale(0.97); }
  to   { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .combo-reveal { animation: none; }
}


.paused-banner {
  background: rgba(var(--color-warn-rgb), 0.08);
  color: var(--color-warn);
  border: 1px solid rgba(var(--color-warn-rgb), 0.2);
  border-radius: 0.625rem;
  font-size: 0.8125rem;
  font-weight: 600;
  padding: 0.5rem 0.875rem;
  text-align: center;
}

.visitor-flash {
  background: rgba(var(--color-accent-rgb), 0.1);
  color: var(--color-accent);
  border: 1px solid rgba(var(--color-accent-rgb), 0.25);
  border-radius: 0.625rem;
  font-size: 0.8125rem;
  font-weight: 600;
  padding: 0.5rem 0.875rem;
  text-align: center;
  margin: 0;
}

.visitor-flash-enter-active,
.visitor-flash-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.visitor-flash-enter-from,
.visitor-flash-leave-to { opacity: 0; transform: translateY(-4px); }

// ── Mood wrap ──────────────────────────────────────────────────────────────

.mood-wrap {
  @include field-group('Your mood');
}

.dash-state__trial {
  display: inline-block;
  margin: 0 0 1rem;
  padding: 0.3rem 0.8rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-brand-text, var(--color-accent));
  background: rgba(var(--color-brand-rgb, var(--color-accent-rgb)), 0.14);
}
</style>
