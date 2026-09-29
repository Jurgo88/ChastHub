<template>
  <div class="dash">
    <AppNav />

    <!-- Loading -->
    <div v-if="initialising" class="dash-state">
      <div class="spinner" />
    </div>

    <template v-else>
      <div class="dash-body">

        <!-- Page header + stats -->
        <div class="dash-header">
          <div class="dash-header__text">
            <h1 class="dash-header__title">Your Locks</h1>
            <p class="dash-header__sub">Manage and control active lock sessions</p>
          </div>
          <!-- Stat cards double as filters: click to filter, click again for all.
               Paused loqs are active sessions, so they live under "Loqs"
               (shown as a sub-count), never split into their own group. -->
          <div class="stats-row">
            <button
              class="stat-card"
              :class="{ 'stat-card--selected': filter === 'loqs' }"
              :aria-pressed="filter === 'loqs'"
              @click="toggleFilter('loqs')"
            >
              <span class="stat-card__value">{{ activeLoqs.length }}</span>
              <span class="stat-card__label">Locks</span>
              <span v-if="pausedCount" class="stat-card__sub">{{ pausedCount }} paused</span>
            </button>
            <button
              class="stat-card"
              :class="{ 'stat-card--selected': filter === 'requests' }"
              :aria-pressed="filter === 'requests'"
              @click="toggleFilter('requests')"
            >
              <span class="stat-card__value">{{ requests.length }}</span>
              <span class="stat-card__label">Requests</span>
            </button>
          </div>
        </div>

        <!-- Loq cards -->
        <div class="loq-list">

          <!-- Active / paused loq cards (paused loqs are still active sessions, always shown together) -->
          <template v-if="filter !== 'requests'">
            <article
              v-for="loq in activeLoqs"
              :key="loq.id"
              class="loq-card"
              :class="[`loq-card--${loq.status}`, { 'loq-card--expanded': isExpanded(loq.id) }]"
            >

              <!-- Summary row: compact view on desktop, header on mobile -->
              <div
                class="loq-card__summary"
                role="button"
                tabindex="0"
                :aria-expanded="isExpanded(loq.id)"
                :aria-controls="`loq-detail-${loq.id}`"
                @click="toggleExpand(loq.id)"
                @keydown.enter.prevent="toggleExpand(loq.id)"
                @keydown.space.prevent="toggleExpand(loq.id)"
              >
                <div class="loq-card__identity">
                  <UserAvatar class="loq-card__avatar" :avatar-url="loq.loqee?.avatar_url" :display-name="loq.loqee?.display_name" />
                  <div>
                    <p class="loq-card__name">{{ loq.loqee?.display_name ?? 'Unknown' }}</p>
                    <p class="loq-card__since">
                      {{ timeAgo(loq.accepted_at) }}<template v-if="loq.emotion"> · {{ emotionEmoji(loq.emotion) }} {{ loq.emotion }}</template>
                    </p>
                    <OnlineIndicator :user-id="loq.loqee?.id" :last-seen-at="loq.loqee?.last_seen_at" />
                  </div>
                </div>
                <LockCountdown
                  class="loq-card__hero-timer"
                  hero
                  :expanded="isExpanded(loq.id)"
                  :locked-until="loq.loqed_until"
                  :paused-at="loq.paused_at"
                  @expired="onExpired(loq.id)"
                />
                <div class="loq-card__summary-meta">
                  <span class="loq-status-pill" :class="`loq-status-pill--${loq.status}`">
                    <span class="loq-status-pill__dot" />
                    {{ loq.status.toUpperCase() }}
                  </span>
                  <span class="loq-card__chevron" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </span>
                </div>
              </div>

              <!-- Detail: collapsed by default, expand via the summary row -->
              <div :id="`loq-detail-${loq.id}`" class="loq-card__detail">

                <!-- Custom time adjust (only while active — the server rejects
                     time changes on paused loqs) -->
                <div class="time-adjust" :class="{ 'time-adjust--locked': loq.status !== 'active' }">
                  <div class="time-adjust__spinners">

                    <div class="adj-spin">
                      <button class="adj-spin__arrow" type="button" :disabled="getAdj(loq.id).days >= MAX_ADJUST_DAYS || adjDisabled(loq)" @click="spinAdj(loq.id, 'days', 1)">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 9l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                      </button>
                      <span class="adj-spin__val">{{ String(getAdj(loq.id).days).padStart(2, '0') }}</span>
                      <button class="adj-spin__arrow" type="button" :disabled="getAdj(loq.id).days <= 0 || adjDisabled(loq)" @click="spinAdj(loq.id, 'days', -1)">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 5l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                      </button>
                      <span class="adj-spin__label">Days</span>
                    </div>

                    <span class="time-adjust__sep">:</span>

                    <div class="adj-spin">
                      <button class="adj-spin__arrow" type="button" :disabled="getAdj(loq.id).hours >= 23 || adjDisabled(loq)" @click="spinAdj(loq.id, 'hours', 1)">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 9l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                      </button>
                      <span class="adj-spin__val">{{ String(getAdj(loq.id).hours).padStart(2, '0') }}</span>
                      <button class="adj-spin__arrow" type="button" :disabled="getAdj(loq.id).hours <= 0 || adjDisabled(loq)" @click="spinAdj(loq.id, 'hours', -1)">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 5l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                      </button>
                      <span class="adj-spin__label">Hours</span>
                    </div>

                    <span class="time-adjust__sep">:</span>

                    <div class="adj-spin">
                      <button class="adj-spin__arrow" type="button" :disabled="getAdj(loq.id).minutes >= 59 || adjDisabled(loq)" @click="spinAdj(loq.id, 'minutes', 1)">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 9l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                      </button>
                      <span class="adj-spin__val">{{ String(getAdj(loq.id).minutes).padStart(2, '0') }}</span>
                      <button class="adj-spin__arrow" type="button" :disabled="getAdj(loq.id).minutes <= 0 || adjDisabled(loq)" @click="spinAdj(loq.id, 'minutes', -1)">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 5l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                      </button>
                      <span class="adj-spin__label">Min</span>
                    </div>

                  </div>

                  <div class="time-adjust__actions">
                    <button
                      class="loq-act loq-act--remove"
                      :disabled="adjDisabled(loq) || adjTotal(loq.id) < 1"
                      @click="applyTimeAdjust(loq.id, -1)"
                    >− Remove {{ adjLabel(loq.id) }}</button>
                    <button
                      class="loq-act loq-act--add"
                      :disabled="adjDisabled(loq) || adjTotal(loq.id) < 1"
                      @click="applyTimeAdjust(loq.id, 1)"
                    >+ Add {{ adjLabel(loq.id) }}</button>
                  </div>

                  <p v-if="loq.status === 'paused'" class="time-adjust__hint">⏸ Resume to adjust the timer</p>

                  <Transition name="flash">
                    <p v-if="cardFlash(loq.id)" class="time-adjust__flash">✓ {{ cardFlash(loq.id) }}</p>
                  </Transition>
                </div>

                <!-- Primary actions -->
                <div class="loq-actions">
                  <button
                    class="loq-act loq-act--pause"
                    :class="{ 'loq-act--resume': loq.status === 'paused' }"
                    :disabled="isPending(loq.id)"
                    @click="togglePause(loq.id)"
                  >{{ loq.status === 'paused' ? '▶ Resume' : '⏸ Pause' }}</button>
                  <button
                    class="loq-act loq-act--chat"
                    :class="{ 'loq-act--chat-open': openChatId === loq.id }"
                    :disabled="isPending(loq.id)"
                    :aria-pressed="openChatId === loq.id"
                    :aria-expanded="openChatId === loq.id"
                    @click="toggleChat(loq.id)"
                  >💬 Chat</button>
                  <button class="loq-act loq-act--end" :disabled="isPending(loq.id)" @click="endLoq(loq.id)">End</button>
                </div>

                <p v-if="cardError(loq.id)" class="loq-card__error">{{ cardError(loq.id) }}</p>

                <!-- Combination -->
                <div v-if="loq.combination_text || loq.combination_photo_url" class="combo-wrap">
                  <div v-if="loq.combination_text" class="combo-row">
                    <code class="combo-row__val">{{ loq.combination_text }}</code>
                    <button class="loq-act loq-act--copy" @click="copyCombo(loq.id, loq.combination_text!)">
                      {{ copiedIds.has(loq.id) ? '✓' : 'Copy' }}
                    </button>
                  </div>
                  <div v-else-if="loq.combination_photo_url" class="combo-photo">
                    <img :src="loq.combination_photo_url" alt="Combination photo" class="combo-photo__img" />
                  </div>
                </div>

                <!-- Visitor share link — loqholder controls both the link and the amount -->
                <div class="visitor-link-wrap">
                  <button
                    v-if="!loq.public_link_id"
                    class="loq-act loq-act--ghost"
                    :disabled="isPending(loq.id)"
                    @click="handleGenerateLink(loq.id)"
                  >🔗 Generate visitor link</button>

                  <template v-else>
                    <div class="visitor-link">
                      <svg class="visitor-link__icon" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M6.5 9.5L9.5 6.5M7 4H5a3 3 0 000 6h1m2-6h2a3 3 0 010 6h-1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      <code class="visitor-link__url">{{ visitorLinkUrl(loq) }}</code>
                      <button class="visitor-link__copy" :class="{ 'visitor-link__copy--done': copiedLinkIds.has(loq.id) }" @click="copyVisitorLink(loq)">
                        {{ copiedLinkIds.has(loq.id) ? '✓ Copied' : 'Copy' }}
                      </button>
                    </div>
                    <p class="visitor-count">{{ loq.visitor_count ?? 0 }} visitor{{ (loq.visitor_count ?? 0) !== 1 ? 's' : '' }} interacted</p>

                    <div class="visitor-amount">
                      <p class="visitor-amount__caption">Each vote changes the timer by</p>

                      <div class="visitor-amount__segmented">
                        <button
                          v-for="preset in VISITOR_PRESETS"
                          :key="preset.hours"
                          type="button"
                          class="visitor-amount__seg"
                          :class="{ 'visitor-amount__seg--active': !showCustomAmount.has(loq.id) && loq.visitor_add_hours === preset.hours }"
                          :disabled="isPending(loq.id)"
                          @click="selectPreset(loq.id, preset.hours)"
                        >{{ preset.label }}</button>
                        <button
                          type="button"
                          class="visitor-amount__seg"
                          :class="{ 'visitor-amount__seg--active': showCustomAmount.has(loq.id) || isCustomAmount(loq) }"
                          :disabled="isPending(loq.id)"
                          @click="toggleCustomAmount(loq.id, loq.visitor_add_hours)"
                        >Custom</button>
                      </div>

                      <Transition name="custom-reveal">
                        <div v-if="showCustomAmount.has(loq.id)" class="visitor-stepper">
                          <button
                            type="button"
                            class="visitor-stepper__btn"
                            :disabled="isPending(loq.id) || customAmountFor(loq) <= MIN_VISITOR_HOURS"
                            @click="stepCustomAmount(loq, -1)"
                          >−</button>
                          <div class="visitor-stepper__val">{{ formatHours(customAmountFor(loq)) }}</div>
                          <button
                            type="button"
                            class="visitor-stepper__btn"
                            :disabled="isPending(loq.id) || customAmountFor(loq) >= MAX_VISITOR_HOURS"
                            @click="stepCustomAmount(loq, 1)"
                          >+</button>
                          <button
                            type="button"
                            class="visitor-stepper__confirm"
                            :disabled="isPending(loq.id) || customAmountFor(loq) === loq.visitor_add_hours"
                            @click="handleSetVisitorAmount(loq.id, customAmountFor(loq))"
                          >Set</button>
                        </div>
                      </Transition>
                    </div>

                    <!-- TASK-089 -->
                    <div class="visitor-amount">
                      <p class="visitor-amount__caption">Visitors can</p>
                      <div class="visitor-amount__segmented">
                        <button
                          v-for="perm in VISITOR_PERMISSIONS"
                          :key="perm.value"
                          type="button"
                          class="visitor-amount__seg"
                          :class="{ 'visitor-amount__seg--active': (loq.visitor_permission ?? 'both') === perm.value }"
                          :disabled="isPending(loq.id)"
                          @click="handleSetVisitorPermission(loq.id, perm.value)"
                        >{{ perm.label }}</button>
                      </div>
                    </div>
                  </template>
                </div>

                <!-- Expandable chat: smooth height transition like the card -->
                <Transition
                  name="chat-expand"
                  @enter="onChatEnter"
                  @after-enter="onChatAfterEnter"
                  @before-leave="onChatBeforeLeave"
                  @leave="onChatLeave"
                >
                  <div v-if="openChatId === loq.id" class="chat-wrap">
                    <LoqChat
                      :loq-id="loq.id"
                      :channel="loqChannels.get(loq.id) ?? null"
                      autofocus
                      @ready="onChatContentReady"
                    />
                  </div>
                </Transition>

              </div>
            </article>
          </template>

          <!-- Request cards -->
          <template v-if="filter === 'all' || filter === 'requests'">
            <article
              v-for="req in requests"
              :key="req.id"
              class="loq-card loq-card--request"
              :class="{ 'loq-card--expanded': isExpanded(req.id) }"
            >
              <!-- Summary row: same 3-col grid as active card -->
              <div
                class="loq-card__summary"
                role="button"
                tabindex="0"
                :aria-expanded="isExpanded(req.id)"
                :aria-controls="`loq-detail-${req.id}`"
                @click="toggleExpand(req.id)"
                @keydown.enter.prevent="toggleExpand(req.id)"
                @keydown.space.prevent="toggleExpand(req.id)"
              >
                <div class="loq-card__identity">
                  <UserAvatar class="loq-card__avatar" :avatar-url="req.loq.loqee?.avatar_url" :display-name="req.loq.loqee?.display_name" />
                  <div>
                    <p class="loq-card__name">{{ req.loq.loqee?.display_name ?? 'Unknown' }}</p>
                    <p class="loq-card__since">
                      {{ timeAgo(req.created_at) }}<template v-if="req.loq.emotion"> · {{ emotionEmoji(req.loq.emotion) }} {{ req.loq.emotion }}</template>
                    </p>
                  </div>
                </div>
                <LockCountdown
                  class="loq-card__hero-timer"
                  hero
                  :expanded="true"
                  :locked-until="req.loq.loqed_until"
                />
                <div class="loq-card__summary-meta">
                  <span class="loq-status-pill loq-status-pill--request">
                    <span class="loq-status-pill__dot" />
                    REQUEST
                  </span>
                  <span class="loq-card__chevron" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </span>
                </div>
              </div>

              <!-- Detail: collapsed by default, expand via the summary row -->
              <div :id="`loq-detail-${req.id}`" class="loq-card__detail">
                <div v-if="req.loq.reason" class="reason-wrap">
                  <p class="card-reason">"{{ req.loq.reason }}"</p>
                </div>
                <div class="loq-actions">
                  <button
                    class="loq-act loq-act--reject"
                    :disabled="pendingAction === req.loq.id"
                    @click="rejectRequest(req.loq.id)"
                  >Reject</button>
                  <button
                    class="loq-act loq-act--accept"
                    :disabled="pendingAction === req.loq.id"
                    @click="acceptRequest(req.loq.id)"
                  >{{ pendingAction === req.loq.id ? 'Accepting…' : '✓ Accept lock' }}</button>
                </div>
              </div>
            </article>
          </template>

          <!-- Empty state -->
          <div v-if="nothingVisible" class="empty-state">
            <p class="empty-state__icon"><img :src="unloqedIcon" class="state-icon" alt="" width="128" height="128" decoding="async"></p>
            <p class="empty-state__title">{{ emptyStateTitle }}</p>
            <p class="empty-state__hint">Open Key Drop to pick up a key.</p>
            <NuxtLink to="/keydrop" class="btn btn--primary">Open Key Drop</NuxtLink>
          </div>

        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// TASK-151 — see LockCountdown: 🔓 rendered as a different padlock on every
// platform, which is a poor thing to hang an empty state on.
import unloqedIcon from '~/assets/images/icons/state-unloqed.webp'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Loq } from '~/types'

definePageMeta({ middleware: 'auth' })

// ─── Types ─────────────────────────────────────────────────────────────────

interface LoqeeProfile { id: string; display_name: string | null; avatar_url: string | null; last_seen_at?: string | null }
type ActiveLoq = Loq & { loqee: LoqeeProfile | null }

interface IncomingRequest {
  id: string
  status: string
  created_at: string
  loq: {
    id: string
    duration_minutes: number
    emotion: string | null
    reason: string | null
    is_public: boolean
    created_at: string
    loqed_until: string | null
    loqee: LoqeeProfile | null
  }
}

// Stat cards act as filter toggles; 'all' is the unfiltered default.
// Paused loqs are still active sessions, so 'loqs' covers active + paused
// together — they are never split into separate filters.
type FilterKey = 'all' | 'loqs' | 'requests'

// ─── State ─────────────────────────────────────────────────────────────────

const authStore = useAuthStore()
const { authFetch } = useAuthFetch()
const { acceptLoq, rejectLoq, togglePause: pauseLoq, endLoq: endLoqAction, adjustTime: adjustLoqTime, generateVisitorLink, setVisitorAmount, setVisitorPermission } = useLoqholder()
const { $supabase } = useNuxtApp()
const { confirm } = useConfirm()

const initialising = ref(true)
const activeLoqs = ref<ActiveLoq[]>([])
const requests = ref<IncomingRequest[]>([])
const filter = ref<FilterKey>('all')
const pendingAction = ref<string | null>(null)

const pendingIds = ref(new Set<string>())
const errorMap = ref(new Map<string, string>())
const copiedIds = ref(new Set<string>())
const flashMap = ref(new Map<string, string>())

const expandedIds = ref(new Set<string>())
function toggleExpand(loqId: string) {
  const s = new Set(expandedIds.value)
  s.has(loqId) ? s.delete(loqId) : s.add(loqId)
  expandedIds.value = s
}
function isExpanded(loqId: string) { return expandedIds.value.has(loqId) }

type TimeAdjust = { days: number; hours: number; minutes: number }
const timeAdjustMap = reactive<Record<string, TimeAdjust>>({})

function getAdj(loqId: string): TimeAdjust {
  if (!timeAdjustMap[loqId]) timeAdjustMap[loqId] = { days: 0, hours: 0, minutes: 0 }
  return timeAdjustMap[loqId]
}

function spinAdj(loqId: string, field: 'days' | 'hours' | 'minutes', delta: number) {
  const adj = getAdj(loqId)
  const max = field === 'days' ? 7 : field === 'hours' ? 23 : 59
  adj[field] = Math.max(0, Math.min(max, adj[field] + delta))
}

function adjTotal(loqId: string): number {
  const a = getAdj(loqId)
  return a.days * 1440 + a.hours * 60 + a.minutes
}

function adjLabel(loqId: string): string {
  const a = getAdj(loqId)
  const parts: string[] = []
  if (a.days) parts.push(`${a.days}d`)
  if (a.hours) parts.push(`${a.hours}h`)
  if (a.minutes) parts.push(`${a.minutes}m`)
  return parts.join(' ') || '—'
}

// Time changes are only allowed on active loqs (the server rejects paused
// ones); pending covers the in-flight request.
function adjDisabled(loq: ActiveLoq): boolean {
  return isPending(loq.id) || loq.status !== 'active'
}

async function applyTimeAdjust(loqId: string, dir: 1 | -1) {
  const total = adjTotal(loqId)
  if (total < 1) return
  const label = adjLabel(loqId) // capture before the spinners reset
  const ok = await adjustTime(loqId, total * dir)
  if (!ok) return
  // Reset so a second click can't silently re-apply the same adjustment,
  // and confirm what just landed.
  timeAdjustMap[loqId] = { days: 0, hours: 0, minutes: 0 }
  flashMessage(loqId, `${dir === 1 ? '+' : '−'}${label} ${dir === 1 ? 'added' : 'removed'}`)
}

const openChatId = ref<string | null>(null)

const loqChannels = new Map<string, RealtimeChannel>()
let requestChannel: RealtimeChannel | null = null
let visitorInteractionChannel: RealtimeChannel | null = null

// ─── Computed ───────────────────────────────────────────────────────────────

// Active + paused count as one group ("loqs"); paused is surfaced separately
// only as a sub-count, never as its own filter.
const pausedCount = computed(() => activeLoqs.value.filter(l => l.status === 'paused').length)

const nothingVisible = computed(() => {
  if (filter.value === 'requests') return requests.value.length === 0
  if (filter.value === 'loqs') return activeLoqs.value.length === 0
  return activeLoqs.value.length === 0 && requests.value.length === 0
})

const emptyStateTitle = computed(() => (filter.value === 'requests' ? 'No requests' : 'No active locks'))

function toggleFilter(key: Exclude<FilterKey, 'all'>) {
  filter.value = filter.value === key ? 'all' : key
}

// ─── Init ──────────────────────────────────────────────────────────────────

onMounted(async () => {
  if (import.meta.client) window.addEventListener('online', handleReconnect)
  try {
    await Promise.all([fetchActiveLoqs(), fetchRequests()])
    subscribeToAll()
  }
  finally { initialising.value = false }
})

onUnmounted(() => {
  loqChannels.forEach(ch => ch.unsubscribe())
  loqChannels.clear()
  requestChannel?.unsubscribe()
  visitorInteractionChannel?.unsubscribe()
  if (import.meta.client) window.removeEventListener('online', handleReconnect)
})

async function handleReconnect() {
  loqChannels.forEach(ch => ch.unsubscribe())
  loqChannels.clear()
  requestChannel?.unsubscribe()
  requestChannel = null
  visitorInteractionChannel?.unsubscribe()
  visitorInteractionChannel = null
  subscribeToAll()
}

function subscribeToAll() {
  activeLoqs.value.forEach(l => subscribeToLoq(l.id))
  subscribeToRequests()
  subscribeToVisitorInteractions()
}

// ─── Data fetch ────────────────────────────────────────────────────────────

async function fetchActiveLoqs() {
  try {
    activeLoqs.value = await authFetch<ActiveLoq[]>('/api/loqholders/active')
  }
  catch { activeLoqs.value = [] }
}

async function fetchRequests() {
  try {
    const res = await authFetch<{ data: IncomingRequest[] }>('/api/loqholders/incoming')
    requests.value = res.data ?? []
  }
  catch { requests.value = [] }
}

// ─── Realtime ──────────────────────────────────────────────────────────────

function subscribeToLoq(loqId: string) {
  if (loqChannels.has(loqId)) return
  const ch = $supabase
    .channel(`loq:${loqId}`)
    .on('broadcast', { event: 'loq_updated' }, (payload: { payload: { loq: Partial<ActiveLoq> } }) => {
      const { loq: updated } = payload.payload
      const idx = activeLoqs.value.findIndex(l => l.id === loqId)
      if (idx !== -1) activeLoqs.value[idx] = { ...activeLoqs.value[idx], ...updated }
    })
    .subscribe()
  loqChannels.set(loqId, ch)
}

function broadcastLoqUpdate(loqId: string, loqData: Partial<ActiveLoq>, loqholder?: { id: string; display_name: string | null; avatar_url: string | null } | null) {
  loqChannels.get(loqId)?.send({ type: 'broadcast', event: 'loq_updated', payload: { loq: loqData, loqholder } })
}

// Public visitor page has its own channel/topic (loq-public:{link}), kept
// separate from loq:{id} above so an anonymous visitor never receives the
// private payload (combination, reason, participant ids) that channel
// carries. Server-side REST broadcast doesn't actually deliver in this
// Supabase project (confirmed empirically) — join briefly and send
// directly instead, same as the private channel does.
function broadcastPublicUpdate(publicLinkId: string | null, payload: Record<string, unknown>) {
  if (!publicLinkId) return
  const ch = $supabase.channel(`loq-public:${publicLinkId}`)
  ch.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      ch.send({ type: 'broadcast', event: 'loq_updated', payload })
      setTimeout(() => ch.unsubscribe(), 500)
    }
  })
}

function unsubscribeFromLoq(loqId: string) {
  loqChannels.get(loqId)?.unsubscribe()
  loqChannels.delete(loqId)
}

function subscribeToRequests() {
  const userId = authStore.profile?.id
  if (!userId) return
  requestChannel = $supabase
    .channel(`lh:requests:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'loq_requests', filter: `loqholder_id=eq.${userId}` },
      // TASK-102 — this fires for both directions: someone requesting this
      // loqholder privately, AND this loqholder's own request-to-join
      // (TASK-087) getting approved/rejected by a loqee. The latter needs
      // activeLoqs refreshed too, or an approval never shows up in "Loqs"
      // without a manual reload.
      async () => { await Promise.all([fetchRequests(), fetchActiveLoqs()]) })
    .subscribe()
}

// TASK-065: flash "Visitor added/removed Xh" on the relevant loq card. The
// countdown itself already updates via the existing loq:{id} broadcast
// (adjust-time.post.ts calls broadcastLoqUpdate) — this only adds the
// notification on top.
function subscribeToVisitorInteractions() {
  const userId = authStore.profile?.id
  if (!userId) return
  visitorInteractionChannel = $supabase
    .channel(`lh:visitor-interactions:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'loq_visitor_interactions', filter: `loqholder_id=eq.${userId}` },
      (payload: { new: { loq_id: string; direction: 'add' | 'remove'; hours_added: number } }) => {
        const { loq_id, direction, hours_added } = payload.new
        flashMessage(loq_id, `Visitor ${direction === 'remove' ? 'removed' : 'added'} ${hours_added}h`)
      },
    )
    .subscribe()
}

// ─── Chat ──────────────────────────────────────────────────────────────────

function toggleChat(loqId: string) {
  openChatId.value = openChatId.value === loqId ? null : loqId
}

// Smooth accordion for the chat: animate the real content height so both
// open and close are fluid (CSS max-height guessing would stall on close).
//
// Scrolling the composer into view has to wait for BOTH the expand animation
// AND the async message load — whichever finishes last. Doing it on just one
// (as before) scrolled to a stale height and under-shot when the other was
// still pending. Two flags gate it; onChatContentReady comes from LoqChat's
// @ready.
let chatWrapEl: HTMLElement | null = null
let chatAnimDone = false
let chatContentReady = false

function onChatEnter(el: Element) {
  const e = el as HTMLElement
  chatWrapEl = e
  chatAnimDone = false
  chatContentReady = false
  e.style.height = '0'
  e.style.opacity = '0'
  void e.offsetHeight // reflow so the start values commit
  e.style.height = `${e.scrollHeight}px`
  e.style.opacity = '1'
}
function onChatAfterEnter(el: Element) {
  const e = el as HTMLElement
  e.style.height = ''
  e.style.opacity = ''
  chatAnimDone = true
  maybeScrollComposerIntoView()
}
function onChatContentReady() {
  chatContentReady = true
  maybeScrollComposerIntoView()
}
function maybeScrollComposerIntoView() {
  if (!chatAnimDone || !chatContentReady || !chatWrapEl) return
  // Align the whole card's bottom to the viewport (not just the composer), so
  // the input sits a little above the edge — by the card's bottom padding.
  const target = chatWrapEl.closest('.loq-card') ?? chatWrapEl
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // rAF so the just-cleared inline height has reflowed to the natural one.
  requestAnimationFrame(() => target.scrollIntoView({ block: 'end', behavior: reduce ? 'auto' : 'smooth' }))
}
function onChatBeforeLeave(el: Element) {
  const e = el as HTMLElement
  e.style.height = `${e.scrollHeight}px`
  e.style.opacity = '1'
  void e.offsetHeight
}
function onChatLeave(el: Element) {
  const e = el as HTMLElement
  e.style.height = '0'
  e.style.opacity = '0'
}

// ─── Request actions ────────────────────────────────────────────────────────

async function acceptRequest(loqId: string) {
  pendingAction.value = loqId
  try {
    const loq = await acceptLoq(loqId) as ActiveLoq
    activeLoqs.value.push(loq)
    requests.value = requests.value.filter(r => r.loq.id !== loqId)
    subscribeToLoq(loq.id)
    broadcastLoqUpdate(loq.id, loq, authStore.profile)
  }
  catch (err: unknown) {
    errorMap.value.set(loqId, (err as Error).message)
  }
  finally { pendingAction.value = null }
}

async function rejectRequest(loqId: string) {
  pendingAction.value = loqId
  try {
    await rejectLoq(loqId)
    requests.value = requests.value.filter(r => r.loq.id !== loqId)
  }
  catch { /* ignore */ }
  finally { pendingAction.value = null }
}

// ─── Active loq actions ────────────────────────────────────────────────────

async function togglePause(loqId: string) {
  setLoading(loqId)
  try {
    const updated = await pauseLoq(loqId)
    patchLoq(loqId, updated)
    broadcastLoqUpdate(loqId, updated)
    broadcastPublicUpdate(updated.public_link_id, {
      status: updated.status,
      loqed_until: updated.loqed_until,
      paused_at: updated.paused_at,
      locked: updated.locked,
    })
  }
  catch (err: unknown) { setError(loqId, (err as Error).message) }
  finally { clearLoading(loqId) }
}

async function adjustTime(loqId: string, deltaMinutes: number): Promise<boolean> {
  setLoading(loqId)
  try {
    const updated = await adjustLoqTime(loqId, deltaMinutes)
    patchLoq(loqId, updated)
    broadcastLoqUpdate(loqId, updated)
    broadcastPublicUpdate(updated.public_link_id, { loqed_until: updated.loqed_until })
    return true
  }
  catch (err: unknown) { setError(loqId, (err as Error).message); return false }
  finally { clearLoading(loqId) }
}

async function endLoq(loqId: string) {
  const ok = await confirm({
    title: 'End this lock?',
    message: 'Your wearer will be unlocked right away and the combination revealed to them. This can’t be undone.',
    confirmLabel: 'End lock',
    cancelLabel: 'Keep lock',
    danger: true,
  })
  if (!ok) return
  const publicLinkId = activeLoqs.value.find(l => l.id === loqId)?.public_link_id ?? null
  setLoading(loqId)
  try {
    await endLoqAction(loqId)
    broadcastLoqUpdate(loqId, { id: loqId, status: 'ended' } as Partial<ActiveLoq>)
    broadcastPublicUpdate(publicLinkId, { status: 'ended', locked: false })
    if (openChatId.value === loqId) openChatId.value = null
    unsubscribeFromLoq(loqId)
    activeLoqs.value = activeLoqs.value.filter(l => l.id !== loqId)
  }
  catch (err: unknown) { setError(loqId, (err as Error).message) }
  finally { clearLoading(loqId) }
}

async function onExpired(loqId: string) {
  await fetchActiveLoqs()
  if (!activeLoqs.value.find(l => l.id === loqId)) {
    unsubscribeFromLoq(loqId)
    if (openChatId.value === loqId) { openChatId.value = null }
  }
}

async function copyCombo(loqId: string, text: string) {
  await navigator.clipboard.writeText(text)
  copiedIds.value = new Set([...copiedIds.value, loqId])
  setTimeout(() => {
    const next = new Set(copiedIds.value)
    next.delete(loqId)
    copiedIds.value = next
  }, 2000)
}

// ─── Visitor share link ────────────────────────────────────────────────────

const VISITOR_PRESETS = [
  { label: '15m', hours: 0.25 },
  { label: '1h', hours: 1 },
  { label: '6h', hours: 6 },
  { label: '1d', hours: 24 },
  { label: '3d', hours: 72 },
]

// TASK-089
const VISITOR_PERMISSIONS = [
  { label: 'Add only', value: 'add' as const },
  { label: 'Remove only', value: 'remove' as const },
  { label: 'Both', value: 'both' as const },
]

const MIN_VISITOR_HOURS = 1 / 60
// Keep both in sync with server/utils/loqValidation.ts MAX_DURATION_MINUTES
// (TASK-085) — server files aren't importable from client pages in Nuxt.
const MAX_VISITOR_HOURS = 3650 * 24
const MAX_ADJUST_DAYS = 3650

const copiedLinkIds = ref(new Set<string>())
const customAmountInputs = reactive<Record<string, number>>({})
const showCustomAmount = ref(new Set<string>())

function isCustomAmount(loq: ActiveLoq): boolean {
  return !VISITOR_PRESETS.some(p => p.hours === loq.visitor_add_hours)
}

function customAmountFor(loq: ActiveLoq): number {
  return customAmountInputs[loq.id] ?? loq.visitor_add_hours
}

function toggleCustomAmount(loqId: string, seed: number) {
  const s = new Set(showCustomAmount.value)
  if (s.has(loqId)) {
    s.delete(loqId)
  }
  else {
    s.add(loqId)
    if (customAmountInputs[loqId] === undefined) customAmountInputs[loqId] = seed
  }
  showCustomAmount.value = s
}

// Finer steps for short amounts, coarser once you're into multi-day territory
// — dragging a slider from 15m to 7 days one hour at a time would be tedious.
function stepSizeFor(hours: number): number {
  if (hours < 1) return 0.25
  if (hours < 6) return 0.5
  if (hours < 24) return 1
  return 6
}

function stepCustomAmount(loq: ActiveLoq, dir: 1 | -1) {
  const current = customAmountFor(loq)
  const next = Math.round((current + dir * stepSizeFor(current)) * 100) / 100
  customAmountInputs[loq.id] = Math.min(MAX_VISITOR_HOURS, Math.max(MIN_VISITOR_HOURS, next))
}

async function selectPreset(loqId: string, hours: number) {
  const s = new Set(showCustomAmount.value)
  s.delete(loqId)
  showCustomAmount.value = s
  await handleSetVisitorAmount(loqId, hours)
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) return hours % 1 === 0 ? `${hours}h` : `${Math.round(hours * 4) / 4}h`
  const days = hours / 24
  return days % 1 === 0 ? `${days}d` : `${Math.round(days * 10) / 10}d`
}

function visitorLinkUrl(loq: ActiveLoq): string {
  if (!loq.public_link_id || !import.meta.client) return ''
  return `${window.location.origin}/lock/${loq.public_link_id}`
}

async function handleGenerateLink(loqId: string) {
  setLoading(loqId)
  try {
    const { public_link_id } = await generateVisitorLink(loqId)
    patchLoq(loqId, { public_link_id })
  }
  catch (err: unknown) { setError(loqId, (err as Error).message) }
  finally { clearLoading(loqId) }
}

async function copyVisitorLink(loq: ActiveLoq) {
  const url = visitorLinkUrl(loq)
  if (!url) return
  await navigator.clipboard.writeText(url)
  copiedLinkIds.value = new Set([...copiedLinkIds.value, loq.id])
  setTimeout(() => {
    const next = new Set(copiedLinkIds.value)
    next.delete(loq.id)
    copiedLinkIds.value = next
  }, 2000)
}

async function handleSetVisitorAmount(loqId: string, hours: number) {
  if (!hours || hours <= 0) return
  setLoading(loqId)
  try {
    const { visitor_add_hours } = await setVisitorAmount(loqId, hours)
    patchLoq(loqId, { visitor_add_hours })
    const s = new Set(showCustomAmount.value)
    s.delete(loqId)
    showCustomAmount.value = s
  }
  catch (err: unknown) { setError(loqId, (err as Error).message) }
  finally { clearLoading(loqId) }
}

// TASK-089
async function handleSetVisitorPermission(loqId: string, permission: 'add' | 'remove' | 'both') {
  setLoading(loqId)
  try {
    const { visitor_permission } = await setVisitorPermission(loqId, permission)
    patchLoq(loqId, { visitor_permission: visitor_permission as 'add' | 'remove' | 'both' })
  }
  catch (err: unknown) { setError(loqId, (err as Error).message) }
  finally { clearLoading(loqId) }
}

// ─── Per-loq loading helpers ───────────────────────────────────────────────

function isPending(id: string) { return pendingIds.value.has(id) }
function cardError(id: string) { return errorMap.value.get(id) ?? '' }
function cardFlash(id: string) { return flashMap.value.get(id) ?? '' }
function flashMessage(id: string, msg: string) {
  flashMap.value = new Map([...flashMap.value, [id, msg]])
  setTimeout(() => {
    const next = new Map(flashMap.value)
    next.delete(id)
    flashMap.value = next
  }, 2500)
}
function setLoading(id: string) { pendingIds.value = new Set([...pendingIds.value, id]); errorMap.value.delete(id) }
function clearLoading(id: string) { const s = new Set(pendingIds.value); s.delete(id); pendingIds.value = s }
function setError(id: string, msg: string) { errorMap.value = new Map([...errorMap.value, [id, msg]]) }
function patchLoq(id: string, patch: Partial<Loq>) {
  const idx = activeLoqs.value.findIndex(l => l.id === id)
  if (idx !== -1) activeLoqs.value[idx] = { ...activeLoqs.value[idx], ...patch }
}

// timeAgo / formatDuration / emotionEmoji come from composables/useLoqFormat.ts
</script>

<style scoped lang="scss">
@use '~/assets/styles/loq-card' as *;

// Shared card/pill/spinner/dash-header styles come from assets/styles/_loq-card.scss

// ── Stats ────────────────────────────────────────────────────────────────────

.stats-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

// Stat cards double as filter toggles (aria-pressed reflects the state)
.stat-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.625rem;
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  font: inherit;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;

  &:hover { border-color: var(--color-accent); }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  &--selected {
    border-color: var(--color-accent);
    background: rgba(var(--color-accent-rgb), 0.08);
  }

  &__value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-accent);
  }

  &__label {
    font-size: 0.6875rem;
    color: var(--color-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  // Paused sub-count: keep the pause orange the client likes
  &__sub {
    font-size: 0.625rem;
    font-weight: 600;
    color: #ffaa00;
    margin-top: 0.125rem;
  }
}

// ── Loq cards ───────────────────────────────────────────────────────────────

.loq-list {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.loq-card {
  // ── Summary row (page-specific: expandable, mobile-first 2-row grid) ──────
  &__summary {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    align-items: center;
    gap: 0.5rem 0.75rem;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    border-radius: 0.5rem;

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 4px;
    }

    .loq-card__identity    { grid-column: 1; grid-row: 1; }
    .loq-card__summary-meta { grid-column: 2; grid-row: 1; align-self: start; }
    .loq-card__hero-timer  { grid-column: 1 / -1; grid-row: 2; }
  }

  // Collapsible at every width — with 20-30 loqs on one account, "always
  // expanded" on mobile stopped being scannable, so mobile now matches
  // desktop: collapsed by default, tap the summary row to expand.
  &__summary { cursor: pointer; }

  &__chevron {
    display: flex;
    color: var(--color-muted);
    line-height: 0;

    svg { transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1); }
  }

  &__detail {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    max-height: 0;
    overflow: hidden;
    padding-top: 0;
    border-top: 1px solid transparent;
    transition:
      max-height 0.38s cubic-bezier(0.4, 0, 0.2, 1),
      padding-top 0.28s ease,
      border-color 0.28s ease;
  }

  &.loq-card--expanded {
    .loq-card__detail {
      max-height: 1200px;
      padding-top: 0.875rem;
      border-top-color: var(--color-border);
    }
    .loq-card__chevron svg { transform: rotate(180deg); }
  }

  // ── Desktop breakpoint: summary row goes from a 2-row mobile stack to a
  // single 3-column row. Purely a layout change — expand/collapse behavior
  // above is now the same at every width. ─────────────────────────────────
  @media (min-width: 768px) {
    &__summary {
      grid-template-columns: 1fr auto 1fr;
      grid-template-rows: auto;
      align-items: center;

      .loq-card__identity    { grid-column: 1; grid-row: 1; }
      .loq-card__hero-timer  { grid-column: 2; grid-row: 1; }
      .loq-card__summary-meta { grid-column: 3; grid-row: 1; justify-self: end; align-self: center; }
    }
  }
}

// ── Primary actions ──────────────────────────────────────────────────────────

.loq-actions {
  display: flex;
  gap: 0.5rem;
}

.loq-act {
  &--pause {
    flex: 1;
    color: var(--color-muted);
    &:hover:not(:disabled) {
      border-color: #ffaa00;
      color: #ffaa00;
      background: rgba(255, 170, 0, 0.06);
    }
  }

  &--resume {
    flex: 1;
    border-color: var(--color-accent);
    color: var(--color-accent);
    background: rgba(var(--color-accent-rgb), 0.08);
    &:hover:not(:disabled) { background: rgba(var(--color-accent-rgb), 0.15); }
  }

  &--chat {
    flex: 1;
    color: var(--color-muted);
    &:hover:not(:disabled) {
      border-color: var(--color-accent);
      color: var(--color-accent);
      background: rgba(var(--color-accent-rgb), 0.06);
    }
  }

  // Chat open: mirror the --resume active look so the toggle state is visible
  &--chat-open {
    border-color: var(--color-accent);
    color: var(--color-accent);
    background: rgba(var(--color-accent-rgb), 0.08);
    &:hover:not(:disabled) { background: rgba(var(--color-accent-rgb), 0.15); }
  }

  // TASK-061: neon orange — this removes time from an active loq.
  &--remove {
    flex: 1;
    color: var(--color-remove);
    border-color: rgba(var(--color-remove-rgb), 0.3);
    font-size: 0.8125rem;
    &:hover:not(:disabled) { background: rgba(var(--color-remove-rgb), 0.08); border-color: var(--color-remove); }
  }

  &--add {
    flex: 1;
    background: var(--color-accent);
    color: var(--color-on-accent);
    border-color: var(--color-accent);
    font-size: 0.8125rem;
    &:hover:not(:disabled) { opacity: 0.88; }
  }

  &--copy {
    padding: 0 0.625rem;
    min-height: 2rem;
    font-size: 0.75rem;
    color: var(--color-muted);
    border-color: var(--color-border);
    &:hover { color: var(--color-accent); border-color: var(--color-accent); background: rgba(var(--color-accent-rgb), 0.06); }
  }

  &--reject {
    flex: 1;
    color: var(--color-danger);
    border-color: rgba(255, 107, 107, 0.3);
    &:hover:not(:disabled) {
      background: rgba(255, 107, 107, 0.08);
      border-color: var(--color-danger);
    }
  }

  &--accept {
    flex: 2;
    background: var(--color-accent);
    color: var(--color-on-accent);
    border-color: var(--color-accent);
    &:hover:not(:disabled) { opacity: 0.88; }
  }

  &--ghost {
    color: var(--color-muted);
    &:hover:not(:disabled) {
      border-color: var(--color-accent);
      color: var(--color-accent);
      background: rgba(var(--color-accent-rgb), 0.06);
    }
  }

  &--outline {
    padding: 0 0.75rem;
    min-height: 2rem;
    font-size: 0.8125rem;
    border-color: var(--color-accent);
    color: var(--color-accent);
    background: rgba(var(--color-accent-rgb), 0.08);
    &:hover:not(:disabled) { background: rgba(var(--color-accent-rgb), 0.15); }
  }
}

// ── Visitor share link ───────────────────────────────────────────────────────

.visitor-link-wrap {
  @include field-group('Share visitor link');
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

// ── Link chip: icon + truncated url + copy ───────────────────────────────────

.visitor-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.5rem 0.5rem 0.75rem;
  border-radius: 0.625rem;
  background: var(--color-bg);
  border: 1px solid var(--color-border);

  &__icon {
    flex-shrink: 0;
    color: var(--color-accent);
  }

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

.visitor-count {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-muted);
}

// ── Visitor amount: segmented control + custom stepper ───────────────────────

.visitor-amount {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  &__caption {
    font-size: 0.75rem;
    color: var(--color-muted);
    margin: 0;
  }

  &__segmented {
    display: flex;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 0.625rem;
    padding: 0.1875rem;
    gap: 0.1875rem;
  }

  &__seg {
    flex: 1;
    min-height: 1.875rem;
    border-radius: 0.4375rem;
    border: none;
    background: none;
    color: var(--color-muted);
    font-size: 0.75rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;

    &:hover:not(:disabled):not(&--active) { color: var(--color-text); }
    &:disabled { opacity: 0.4; cursor: not-allowed; }

    &--active {
      background: var(--color-accent);
      color: var(--color-on-accent);
      box-shadow: 0 1px 4px rgba(var(--color-accent-rgb), 0.45);
    }
  }
}

// Quantity-stepper card for the custom amount — large centred value flanked
// by round +/- buttons, matching the "confident, tactile" feel of the
// segmented control above rather than a bare <input type=number>.
.visitor-stepper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.625rem;
  border-radius: 0.625rem;
  background: var(--color-bg);
  border: 1px solid var(--color-border);

  &__btn {
    flex-shrink: 0;
    width: 1.875rem;
    height: 1.875rem;
    border-radius: 50%;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 1.125rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s, border-color 0.12s, color 0.12s;

    &:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
    &:disabled { opacity: 0.35; cursor: not-allowed; }
  }

  &__val {
    min-width: 3.5rem;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 1rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--color-accent);
  }

  &__confirm {
    flex-shrink: 0;
    margin-left: 0.25rem;
    min-height: 1.875rem;
    padding: 0 0.875rem;
    border-radius: 0.5rem;
    border: 1px solid var(--color-accent);
    background: rgba(var(--color-accent-rgb), 0.1);
    color: var(--color-accent);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.12s;

    &:hover:not(:disabled) { background: var(--color-accent); color: var(--color-on-accent); }
    &:disabled { opacity: 0.4; cursor: not-allowed; }
  }
}

.custom-reveal-enter-active,
.custom-reveal-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.custom-reveal-enter-from,
.custom-reveal-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

// ── Custom time adjust ───────────────────────────────────────────────────────

.time-adjust {
  @include field-group('Adjust time');
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  &__spinners {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 0.375rem;
  }

  &__sep {
    font-size: 1.75rem;
    font-weight: 300;
    color: var(--color-border);
    line-height: 1;
    margin-top: 0.5rem;
    user-select: none;
  }

  &__actions {
    display: flex;
    gap: 0.5rem;
  }

  &__flash {
    margin: 0;
    text-align: center;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #00c864;
  }

  &__hint {
    margin: 0;
    text-align: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: #ffaa00;
  }

  // Paused: dim the (disabled) spinners so the hint reads as the active element
  &--locked .time-adjust__spinners { opacity: 0.4; }
}

// Success flash: fade + slight rise, respects reduced motion
.flash-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.flash-leave-active { transition: opacity 0.3s ease; }
.flash-enter-from { opacity: 0; transform: translateY(4px); }
.flash-leave-to { opacity: 0; }

// Chat accordion: height/opacity driven by JS hooks (onChatEnter/Leave),
// same easing + timing as the card expand so it feels consistent.
.chat-wrap { overflow: hidden; }
.chat-expand-enter-active,
.chat-expand-leave-active {
  transition:
    height 0.38s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.28s ease;
}

@media (prefers-reduced-motion: reduce) {
  .flash-enter-active,
  .flash-leave-active,
  .chat-expand-enter-active,
  .chat-expand-leave-active { transition: none; }
}

.adj-spin {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;

  &__arrow {
    width: 2.75rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-muted);
    border-radius: 0.375rem;
    transition: color 0.12s, background 0.12s;
    -webkit-tap-highlight-color: transparent;

    &:hover:not(:disabled) {
      color: var(--color-accent);
      background: rgba(var(--color-accent-rgb), 0.07);
    }
    &:active:not(:disabled) { background: rgba(var(--color-accent-rgb), 0.14); }
    &:disabled { opacity: 0.2; cursor: default; }
    svg { display: block; }
  }

  &__val {
    width: 2.75rem;
    height: 2.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.625rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--color-text);
    line-height: 1;
  }

  &__label {
    font-size: 0.5625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-muted);
    margin-top: 0.125rem;
  }
}

// ── Combination wrapper ──────────────────────────────────────────────────────

.combo-wrap {
  @include field-group('Combination');
}

// ── Combination row ─────────────────────────────────────────────────────────

.combo-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(0,0,0,0.2);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;

  &__val {
    font-family: var(--font-mono);
    font-size: 0.9375rem;
    color: var(--color-accent);
    flex: 1;
    word-break: break-all;
  }
}

// ── Combination photo ────────────────────────────────────────────────────────

.combo-photo {
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  overflow: hidden;

  &__img {
    display: block;
    width: 100%;
    max-height: 12rem;
    object-fit: contain;
    background: rgba(0,0,0,0.2);
  }
}

// ── Empty state ──────────────────────────────────────────────────────────────

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.625rem;
  padding: 3rem 1rem;
  text-align: center;

  &__icon { font-size: 2.5rem; opacity: 0.5; }
  &__title { font-size: 1rem; font-weight: 600; color: var(--color-text); }
  &__hint { font-size: 0.875rem; color: var(--color-muted); }
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
  text-decoration: none;
  transition: opacity 0.15s;

  &--primary { background: var(--color-accent); color: var(--color-on-accent); &:hover { opacity: 0.9; } }
}
</style>
