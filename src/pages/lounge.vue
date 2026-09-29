<template>
  <div class="dash lg-page">
    <AppNav />

    <div class="lg">
      <section class="room">
        <!-- ── Header ───────────────────────────────────────────────────── -->
        <header class="rh">
          <span class="rh__icon" aria-hidden="true">🔒</span>
          <div class="rh__mid">
            <h1>Locktober Lounge</h1>
            <div class="rh__sub">
              <template v-if="isOpen">
                <span class="live"><i />LIVE</span>
                <span>{{ hereCount }} here now</span>
              </template>
              <span v-else>Closed</span>
              <template v-if="dayLabel"><span aria-hidden="true">·</span><span>{{ dayLabel }}</span></template>
              <span v-if="isOpen && status?.open" class="rh__left">· {{ countdown(status.open.end, now) }} left</span>
            </div>
          </div>
          <span v-if="isOpen && status?.open" class="rh__pill">Closes in {{ countdown(status.open.end, now) }}</span>
          <span v-else-if="status?.next" class="rh__pill">Opens in {{ countdown(status.next.start, now) }}</span>
        </header>

        <!-- ── Closed ───────────────────────────────────────────────────── -->
        <div v-if="showClosed" class="closed">
          <div class="closed__icon" aria-hidden="true">🔒</div>
          <h2>{{ status?.enabled ? 'The Lounge is closed' : 'The Lounge opens soon' }}</h2>
          <template v-if="status?.next">
            <p>Next up: the {{ status.next.name }} session.</p>
            <div class="closed__count">{{ countdown(status.next.start, now) }}</div>
            <p>until {{ localTime(status.next.start) }}{{ isToday(status.next.start) ? ' today' : ` on ${localDay(status.next.start)}` }}</p>
            <div class="closed__btns">
              <button class="pbtn" :class="reminderSet ? 'pbtn--active' : 'pbtn--primary'" type="button" :disabled="reminding" @click="toggleReminder">
                {{ reminderSet ? '✓ Reminder set' : '🔔 Remind me' }}
              </button>
              <button v-if="messages.length" class="pbtn" type="button" @click="readPast = true">Read the last session</button>
            </div>
            <p v-if="reminderSet && pushOff" class="closed__hint">
              Turn on notifications in <NuxtLink to="/profile?tab=notifications">Profile</NuxtLink> so the reminder reaches you.
            </p>
          </template>
          <p v-else>There are no more sessions planned. See you next Locktober.</p>

          <div v-if="status?.last_session && status.last_session.messages" class="closed__stats">
            <div><b>{{ status.last_session.people }}</b><span>people last session</span></div>
            <div><b>{{ status.last_session.messages }}</b><span>messages</span></div>
          </div>
          <div v-if="status?.question" class="closed__teaser">Next question: <b>{{ status.question.text }}</b></div>
        </div>

        <!-- ── Room ─────────────────────────────────────────────────────── -->
        <template v-else>
          <button v-if="readPast && !isOpen" class="back-closed" type="button" @click="readPast = false">‹ Back</button>

          <div v-if="status?.question" class="q">
            <div>
              <div class="q__k">Question of the day · Day {{ status.question.day }}</div>
              <div class="q__t">{{ status.question.text }}</div>
            </div>
            <div class="q__side">
              <span>{{ answers }} {{ answers === 1 ? 'answer' : 'answers' }}</span>
              <button v-if="me?.can_post" class="q__btn" type="button" @click="answerQuestion">Answer</button>
            </div>
          </div>

          <div ref="feedEl" class="feed" @scroll="onScroll">
            <div v-if="loading" class="feed__state"><div class="spinner spinner--sm" /></div>
            <template v-else>
              <button v-if="hasMore" class="feed__older" type="button" :disabled="loadingOlder" @click="loadOlder">
                {{ loadingOlder ? 'Loading…' : 'Load earlier messages' }}
              </button>
              <p v-if="!messages.length" class="feed__state">Nobody has said anything yet. Be the first.</p>
              <LoungeRow
                v-for="m in messages"
                :key="m.id"
                :msg="m"
                :me-id="authStore.profile?.id"
                :moderator="!!me?.moderator"
                :can-write="!!me?.can_post"
                @reply="startReply"
                @report="reporting = $event"
                @delete="removeMessage"
                @mute="muteAuthor"
              />
            </template>
          </div>

          <button v-if="unseen" class="jump" type="button" @click="scrollToBottom(true)">{{ unseen }} new ↓</button>

          <template v-if="me?.can_post">
            <div v-if="replyTo || answering" class="ctx">
              <span v-if="replyTo">Replying to <b>{{ replyTo.author?.display_name ?? 'message' }}</b></span>
              <span v-else>Answering the question of the day</span>
              <button type="button" aria-label="Cancel" @click="replyTo = null; answering = false">✕</button>
            </div>
            <form class="compose" @submit.prevent="send">
              <textarea
                ref="inputEl"
                v-model="draft"
                class="compose__box"
                rows="1"
                maxlength="500"
                placeholder="Say something to the lounge…"
                aria-label="Message"
                @input="grow"
                @keydown.enter="onEnter"
              />
              <button class="compose__send" type="submit" :disabled="!draft.trim() || sending || cooldown > 0" aria-label="Send">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M4 12l16-8-6 16-2.5-6.5z" /></svg>
              </button>
            </form>
            <div class="hint">
              <span v-if="error" class="hint__err">{{ error }}</span>
              <span v-else-if="draft.length > 400">{{ 500 - draft.length }} characters left</span>
              <span v-else>Text only · <span class="hint__kb">Enter to send</span></span>
              <b v-if="cooldown > 0">Slow mode · {{ cooldown }}s</b>
              <b v-else-if="status?.slow_mode_seconds">Slow mode · {{ status.slow_mode_seconds }}s</b>
            </div>
          </template>
          <p v-else-if="me?.blocked_reason && isOpen" class="blocked">{{ me.blocked_reason }}</p>
        </template>
      </section>

      <!-- ── Side ───────────────────────────────────────────────────────── -->
      <aside class="side">
        <div v-if="locktober?.active" class="lt">
          <small>Locktober {{ locktober.year }}</small>
          <strong>Day {{ locktober.day }}</strong>
          <span>{{ locktober.survivors }} survivors still going · {{ 31 - (locktober.day ?? 0) }} days left</span>
          <div class="lt__cal" aria-hidden="true"><i v-for="d in 31" :key="d" :class="{ d: d < (locktober.day ?? 0), t: d === locktober.day }" /></div>
        </div>

        <div v-if="isOpen">
          <h4>Here now</h4>
          <div class="here">
            <UserAvatar v-for="p in hereShown.slice(0, 8)" :key="p.id" class="here__av" :avatar-url="p.a" :display-name="p.n" :title="p.n ?? undefined" />
            <em v-if="hereCount > 8">+{{ hereCount - 8 }}</em>
          </div>
        </div>

        <div v-if="status?.sessions?.length">
          <h4>Open hours</h4>
          <p class="hours">Every evening in October, your time:</p>
          <ul class="hours__list">
            <li v-for="s in sessionTimes" :key="s.name"><span>{{ s.name }}</span><b>{{ s.label }}</b></li>
          </ul>
        </div>

        <div>
          <h4>House rules</h4>
          <ul class="rules">
            <li>Text only. No photos, no links.</li>
            <li>Be kind. Teasing yes, harassment no.</li>
            <li>No asking for money or gifts.</li>
            <li>Take it to Messages for anything private.</li>
          </ul>
        </div>
      </aside>
    </div>

    <ReportModal
      v-if="reporting?.author"
      :reported-user-id="reporting.author.id"
      :lounge-message-id="reporting.id"
      @close="reporting = null"
    />
  </div>
</template>

<script setup lang="ts">
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { LoungeMe, LoungeMessage, StatsPulse } from '~/types'
import { countdown, windowsAround } from '~/utils/loungeSchedule'

definePageMeta({ middleware: 'auth', footer: false })
useHead({ title: 'Locktober Lounge' })

const authStore = useAuthStore()
const { authFetch } = useAuthFetch()
const { $supabase } = useNuxtApp()
const { status, now, isOpen, refresh: refreshStatus, start: startStatus } = useLoungeStatus()

const messages = ref<LoungeMessage[]>([])
const me = ref<LoungeMe | null>(null)
const answers = ref(0)
const hasMore = ref(false)
const loading = ref(true)
const loadingOlder = ref(false)
const readPast = ref(false)
const feedEl = ref<HTMLElement | null>(null)
const unseen = ref(0)

const showClosed = computed(() => !isOpen.value && !readPast.value && !me.value?.moderator)

const locktober = ref<StatsPulse['locktober'] | null>(null)
const dayLabel = computed(() => {
  const d = status.value?.open?.day ?? (locktober.value?.active ? locktober.value.day : null)
  return d ? `Day ${d} of 31` : ''
})

// ── Loading ─────────────────────────────────────────────────────────────────
function atBottom() {
  const el = feedEl.value
  return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 140
}

function scrollToBottom(smooth = false) {
  const el = feedEl.value
  if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  unseen.value = 0
}

function onScroll() { if (atBottom()) unseen.value = 0 }

async function loadAll() {
  try {
    const res = await authFetch<{ messages: LoungeMessage[]; has_more: boolean; me: LoungeMe; answers: number }>('/api/lounge/messages')
    messages.value = res.messages
    hasMore.value = res.has_more
    me.value = res.me
    answers.value = res.answers
  }
  catch { /* keeps what is on screen */ }
  finally {
    loading.value = false
    await nextTick()
    scrollToBottom()
  }
}

let fetching = false
let again = false
async function loadNew() {
  if (fetching) { again = true; return }
  fetching = true
  try {
    const last = messages.value[messages.value.length - 1]
    const q = last ? `?after=${encodeURIComponent(last.created_at)}` : ''
    const stick = atBottom()
    const res = await authFetch<{ messages: LoungeMessage[]; me: LoungeMe; answers: number }>(`/api/lounge/messages${q}`)
    me.value = res.me
    answers.value = res.answers
    const known = new Set(messages.value.map(m => m.id))
    const fresh = res.messages.filter(m => !known.has(m.id))
    if (fresh.length) {
      messages.value.push(...fresh)
      if (messages.value.length > 400) messages.value.splice(0, messages.value.length - 400)
      await nextTick()
      if (stick) scrollToBottom()
      else unseen.value += fresh.length
    }
  }
  catch { /* next ping or poll tries again */ }
  finally {
    fetching = false
    if (again) { again = false; loadNew() }
  }
}

async function loadOlder() {
  const first = messages.value[0]
  if (!first || loadingOlder.value) return
  loadingOlder.value = true
  const el = feedEl.value
  const before = el?.scrollHeight ?? 0
  try {
    const res = await authFetch<{ messages: LoungeMessage[]; has_more: boolean }>(`/api/lounge/messages?before=${encodeURIComponent(first.created_at)}`)
    messages.value = [...res.messages, ...messages.value]
    hasMore.value = res.has_more
    await nextTick()
    if (el) el.scrollTop = el.scrollHeight - before
  }
  catch { /* button stays */ }
  finally { loadingOlder.value = false }
}

// ── Realtime ────────────────────────────────────────────────────────────────
// The broadcast only says "something changed"; content always comes from the
// API, so nobody can inject messages through the public channel.
let channel: RealtimeChannel | null = null
let presence: RealtimeChannel | null = null
let pingTimer: ReturnType<typeof setTimeout> | null = null
let poll: ReturnType<typeof setInterval> | null = null

interface HerePerson { id: string; n: string | null; a: string | null }
const herePeople = ref<HerePerson[]>([])
// Until presence syncs, at least you are here.
const hereShown = computed<HerePerson[]>(() => herePeople.value.length
  ? herePeople.value
  : authStore.profile ? [{ id: authStore.profile.id, n: authStore.profile.display_name, a: authStore.profile.avatar_url }] : [])
const hereCount = computed(() => hereShown.value.length)

function subscribe() {
  channel = $supabase.channel('lounge')
  channel.on('broadcast', { event: 'update' }, ({ payload }: { payload: { deleted?: string; reload?: boolean } }) => {
    if (payload?.deleted) messages.value = messages.value.filter(m => m.id !== payload.deleted)
    if (payload?.reload) { refreshStatus(); loadAll(); return }
    if (pingTimer) clearTimeout(pingTimer)
    pingTimer = setTimeout(loadNew, 250)
  }).subscribe()

  const id = authStore.profile?.id
  if (!id) return
  presence = $supabase.channel('lounge-presence', { config: { presence: { key: id } } })
  presence
    .on('presence', { event: 'sync' }, () => {
      const state = presence!.presenceState<HerePerson>()
      herePeople.value = Object.values(state).map(list => list[0]!).filter(Boolean)
    })
    .subscribe(async (s) => {
      if (s === 'SUBSCRIBED') {
        await presence!.track({ id, n: authStore.profile?.display_name ?? null, a: authStore.profile?.avatar_url ?? null })
      }
    })
}

// ── Writing ─────────────────────────────────────────────────────────────────
const draft = ref('')
const sending = ref(false)
const error = ref('')
const cooldown = ref(0)
const replyTo = ref<LoungeMessage | null>(null)
const answering = ref(false)
const inputEl = ref<HTMLTextAreaElement | null>(null)
let cooldownTimer: ReturnType<typeof setInterval> | null = null

function startCooldown(seconds: number) {
  cooldown.value = seconds
  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    cooldown.value = Math.max(0, cooldown.value - 1)
    if (!cooldown.value && cooldownTimer) clearInterval(cooldownTimer)
  }, 1000)
}

function grow() {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 140)}px`
}

function focusInput() { nextTick(() => inputEl.value?.focus({ preventScroll: true })) }

function onEnter(e: KeyboardEvent) {
  if (e.shiftKey || e.isComposing || window.matchMedia('(pointer: coarse)').matches) return
  e.preventDefault()
  send()
}

function startReply(m: LoungeMessage) {
  replyTo.value = m
  answering.value = false
  focusInput()
}

function answerQuestion() {
  answering.value = true
  replyTo.value = null
  focusInput()
}

async function send() {
  const content = draft.value.trim()
  if (!content || sending.value || cooldown.value > 0) return
  sending.value = true
  error.value = ''
  try {
    const msg = await authFetch<LoungeMessage>('/api/lounge/messages', {
      method: 'POST',
      body: {
        content,
        reply_to: replyTo.value?.id,
        question_day: answering.value ? status.value?.question?.day : undefined,
      },
    })
    draft.value = ''
    replyTo.value = null
    if (answering.value) answers.value += 1
    answering.value = false
    nextTick(grow)
    if (!messages.value.some(m => m.id === msg.id)) messages.value.push(msg)
    await nextTick()
    scrollToBottom()
    if (!me.value?.moderator && status.value?.slow_mode_seconds) startCooldown(status.value.slow_mode_seconds)
  }
  catch (err) {
    const e = err as { data?: { message?: string }; response?: { headers?: Headers } }
    error.value = e?.data?.message ?? 'Could not send. Try again.'
    const retry = Number(e?.response?.headers?.get?.('retry-after'))
    if (retry > 0) startCooldown(retry)
  }
  finally {
    sending.value = false
    inputEl.value?.focus({ preventScroll: true })
  }
}

// ── Moderation ──────────────────────────────────────────────────────────────
const reporting = ref<LoungeMessage | null>(null)

async function removeMessage(m: LoungeMessage) {
  try {
    await authFetch(`/api/lounge/messages/${m.id}`, { method: 'DELETE' })
    messages.value = messages.value.filter(x => x.id !== m.id)
  }
  catch { error.value = 'Could not delete that message.' }
}

async function muteAuthor(m: LoungeMessage, hours: number) {
  if (!m.author) return
  try {
    await authFetch('/api/lounge/mute', { method: 'POST', body: { user_id: m.author.id, hours, delete_messages: false } })
    messages.value.push({
      id: `local-${Date.now()}`,
      kind: 'system',
      content: `${m.author.display_name ?? 'User'} is muted for ${hours >= 48 ? `${Math.round(hours / 24)} days` : `${hours}h`} (only you see this note).`,
      created_at: new Date().toISOString(),
      question_day: null,
      reply_to: null,
      author: null,
    })
    nextTick(() => scrollToBottom())
  }
  catch { error.value = 'Could not mute.' }
}

// ── Reminder ────────────────────────────────────────────────────────────────
const reminding = ref(false)
const reminderSet = computed(() => !!me.value?.reminder_for && me.value.reminder_for === status.value?.next?.start)
const pushOff = computed(() => import.meta.client && (!('Notification' in window) || Notification.permission !== 'granted'))

async function toggleReminder() {
  reminding.value = true
  try {
    const res = await authFetch<{ reminder_for: string | null }>('/api/lounge/remind', { method: 'POST', body: { on: !reminderSet.value } })
    if (me.value) me.value = { ...me.value, reminder_for: res.reminder_for }
  }
  catch { /* button stays as it was */ }
  finally { reminding.value = false }
}

// ── Times shown in the viewer's own zone ────────────────────────────────────
function localTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
function localDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
function isToday(iso: string) {
  return new Date(iso).toDateString() === new Date(now.value).toDateString()
}

const sessionTimes = computed(() => {
  const s = status.value
  if (!s?.sessions?.length) return []
  // Any date inside October works for the local hours; use the middle.
  const ref = Math.min(Math.max(now.value, Date.parse('2026-10-02T12:00:00Z')), Date.parse('2026-10-30T12:00:00Z'))
  const windows = windowsAround(s.sessions, '2000-01-01', '2100-01-01', ref)
  return s.sessions.map((def) => {
    const w = windows.find(x => x.name === def.name)
    return { name: def.name, label: w ? `${localTime(w.start)} to ${localTime(w.end)}` : `${def.start} to ${def.end}` }
  })
})

// ── Lifecycle ───────────────────────────────────────────────────────────────
watch(isOpen, (open, was) => {
  if (open && !was) { readPast.value = false; loadAll() }
})

onMounted(async () => {
  startStatus()
  await refreshStatus()
  await loadAll()
  subscribe()
  poll = setInterval(() => { if (document.visibilityState === 'visible' && (isOpen.value || readPast.value)) loadNew() }, 20_000)
  try {
    const pulse = await $fetch<StatsPulse>('/api/stats/pulse')
    locktober.value = pulse.locktober
  }
  catch { /* side card just stays hidden */ }
})

onBeforeUnmount(() => {
  if (poll) clearInterval(poll)
  if (cooldownTimer) clearInterval(cooldownTimer)
  if (pingTimer) clearTimeout(pingTimer)
  if (channel) $supabase.removeChannel(channel)
  if (presence) $supabase.removeChannel(presence)
})
</script>

<style scoped lang="scss">
@use '~/assets/styles/loq-card' as *;
@use '~/assets/styles/profile' as *;

.lg-page {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  height: 100dvh;
  overflow: hidden;
}

.lg {
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: 1200px;
  margin: 18px auto;
  padding: 0 20px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  grid-template-rows: minmax(0, 1fr);
}

.room {
  position: relative;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-right: 0;
  border-radius: 26px 0 0 26px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(14, 0, 51, 0.35), rgba(14, 0, 51, 0.7)), var(--color-surface);
}

.rh {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 22px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);

  &__icon {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    border-radius: 14px;
    background: var(--gradient-brand);
    display: grid;
    place-items: center;
    font-size: 22px;
  }

  &__mid { flex: 1; min-width: 0; }
  h1 { margin: 0; font: 700 19px var(--font-display); }

  &__sub {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    margin-top: 3px;
    font-size: 12px;
    color: var(--color-text-muted);
  }

  &__left { display: none; }

  &__pill {
    flex-shrink: 0;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid var(--color-border);
    font-size: 12px;
    color: var(--color-text-muted);
    white-space: nowrap;
  }
}

.live {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--color-success);
  font-weight: 700;
  letter-spacing: 0.05em;

  i { width: 7px; height: 7px; border-radius: 50%; background: var(--color-success); box-shadow: 0 0 8px var(--color-success); }
}

.back-closed {
  align-self: flex-start;
  margin: 10px 22px 0;
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-text-muted);
  font: 600 12px var(--font-sans);
  cursor: pointer;
}

.q {
  margin: 14px 22px 6px;
  padding: 14px 16px;
  border-radius: 18px;
  background: linear-gradient(120deg, rgba(var(--color-brand-rgb), 0.18), rgba(var(--color-cta-rgb), 0.1));
  border: 1px solid rgba(var(--color-brand-rgb), 0.4);
  display: flex;
  gap: 12px;
  align-items: flex-start;

  &__k { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #FFD2C0; }
  &__t { margin-top: 3px; font: 700 17px var(--font-display); }

  &__side {
    margin-left: auto;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    flex-shrink: 0;
    font-size: 12px;
    color: #E6DAFF;
  }

  &__btn {
    padding: 5px 12px;
    border-radius: 999px;
    border: 0;
    background: var(--gradient-brand);
    color: var(--color-on-accent);
    font: 700 12px var(--font-sans);
    cursor: pointer;
  }
}

.feed {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 22px 10px;
  display: flex;
  flex-direction: column;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;

  &__state { margin: auto; padding: 30px; color: var(--color-text-muted); font-size: 14px; text-align: center; }

  &__older {
    align-self: center;
    margin: 6px 0 8px;
    padding: 6px 14px;
    border-radius: 999px;
    border: 1px solid var(--color-border);
    background: none;
    color: var(--color-text-muted);
    font: 600 12px var(--font-sans);
    cursor: pointer;
  }
}

.jump {
  position: absolute;
  left: 50%;
  bottom: 110px;
  transform: translateX(-50%);
  padding: 7px 14px;
  border-radius: 999px;
  border: 0;
  background: var(--gradient-brand);
  color: var(--color-on-accent);
  font: 700 12px var(--font-sans);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  cursor: pointer;
}

.ctx {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 20px;
  border-top: 1px solid var(--color-border);
  background: rgba(var(--color-accent-rgb), 0.08);
  font-size: 12px;
  color: #E6DAFF;

  b { color: var(--color-accent); }
  button { border: 0; background: none; color: var(--color-text-muted); cursor: pointer; font-size: 14px; }
}

.compose {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  padding: 12px 18px 6px;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);

  &__box {
    flex: 1;
    min-height: 46px;
    max-height: 140px;
    resize: none;
    border-radius: 22px;
    border: 1.5px solid var(--color-border);
    background: var(--color-bg);
    padding: 12px 16px;
    color: var(--color-text);
    font: 15px/1.4 var(--font-sans);
    outline: 0;

    &::placeholder { color: var(--color-text-muted); }
    &:focus { border-color: var(--color-accent); }
  }

  &__send {
    width: 46px;
    height: 46px;
    flex-shrink: 0;
    border-radius: 50%;
    border: 0;
    background: var(--gradient-brand);
    color: var(--color-on-accent);
    display: grid;
    place-items: center;
    cursor: pointer;

    svg { width: 20px; height: 20px; }
    &:disabled { opacity: 0.45; cursor: not-allowed; }
  }
}

.hint {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 0 20px 10px;
  font-size: 11px;
  color: var(--color-text-muted);
  background: var(--color-surface);

  b { color: var(--color-warn); font-weight: 600; }
  &__err { color: var(--color-danger); }
}

.blocked {
  margin: 0;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 13px;
  text-align: center;
}

.closed {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 28px;
  text-align: center;
  background: radial-gradient(500px 320px at 50% 20%, rgba(var(--color-brand-rgb), 0.22), transparent 70%);

  &__icon {
    width: 84px;
    height: 84px;
    border-radius: 26px;
    background: var(--gradient-brand);
    display: grid;
    place-items: center;
    font-size: 40px;
    margin-bottom: 6px;
  }

  h2 { margin: 0; font: 700 26px var(--font-display); }
  p { margin: 0; color: var(--color-text-muted); font-size: 14px; line-height: 1.5; }

  &__count { font: 700 44px var(--font-display); letter-spacing: -0.02em; margin: 4px 0; font-variant-numeric: tabular-nums; }
  &__btns { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 10px; }
  &__hint { font-size: 12px !important; a { color: var(--color-accent); } }

  &__stats {
    display: flex;
    gap: 26px;
    margin-top: 14px;

    div { text-align: center; }
    b { display: block; font: 700 22px var(--font-display); }
    span { font-size: 11px; color: var(--color-text-muted); letter-spacing: 0.06em; text-transform: uppercase; }
  }

  &__teaser {
    margin-top: 14px;
    padding: 12px 14px;
    max-width: 340px;
    border-radius: 16px;
    border: 1px dashed rgba(var(--color-accent-rgb), 0.5);
    font-size: 13px;
    color: #E6DAFF;
  }
}

.side {
  min-height: 0;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  border: 1px solid var(--color-border);
  border-radius: 0 26px 26px 0;
  background: var(--color-surface);

  h4 { margin: 0 0 8px; font: 700 12px var(--font-sans); color: var(--color-text-muted); letter-spacing: 0.1em; text-transform: uppercase; }
}

.lt {
  padding: 16px;
  border-radius: 18px;
  background:
    radial-gradient(300px 160px at 100% 0%, rgba(var(--color-cta-rgb), 0.4), transparent 70%),
    linear-gradient(120deg, var(--color-elevated), var(--color-surface));
  border: 1px solid rgba(var(--color-accent-rgb), 0.4);

  small { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #FFD2C0; }
  strong { display: block; margin: 2px 0; font: 700 30px var(--font-display); }
  span { font-size: 12px; color: #E6DAFF; }

  &__cal {
    display: grid;
    grid-template-columns: repeat(31, 1fr);
    gap: 2px;
    margin-top: 10px;

    i { height: 6px; border-radius: 2px; background: rgba(255, 255, 255, 0.14); }
    i.d { background: var(--gradient-brand); }
    i.t { background: #fff; }
  }
}

.here {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;

  &__av { display: block; width: 30px; height: 30px; border-radius: 50%; }
  em { font-style: normal; font-size: 12px; color: var(--color-text-muted); margin-left: 4px; }
}

.hours { margin: 0 0 6px; font-size: 13px; color: #CFC5F2; }

.hours__list {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 14px;

  li { display: flex; justify-content: space-between; gap: 10px; padding: 5px 0; }
  span { color: var(--color-text-muted); }
  b { font-family: var(--font-display); }
}

.rules {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
  color: #CFC5F2;
  line-height: 1.5;

  li { padding: 6px 0; border-top: 1px solid var(--color-border); }
  li:first-child { border-top: 0; }
}

@media (max-width: 1000px) {
  .lg { grid-template-columns: minmax(0, 1fr); }
  .side { display: none; }
  .room { border-right: 1px solid var(--color-border); border-radius: 26px; }
}

@media (max-width: 700px) {
  .lg { margin: 0; padding: 0; }
  .room { border: 0; border-radius: 0; }
  .rh { padding: 12px 14px; gap: 10px; }
  .rh__icon { width: 38px; height: 38px; font-size: 19px; border-radius: 12px; }
  .rh__pill { display: none; }
  .rh__left { display: inline; }
  .q { margin: 10px 12px 4px; padding: 12px 14px; }
  .q__t { font-size: 15px; }
  .feed { padding: 4px 8px; }
  .compose { padding: 10px 12px calc(6px + env(safe-area-inset-bottom)); }
  .hint { padding: 0 14px 8px; }
  .hint__kb { display: none; }
  .closed__count { font-size: 38px; }
}
</style>
