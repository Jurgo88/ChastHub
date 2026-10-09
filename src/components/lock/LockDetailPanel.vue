<template>
  <section class="ldp" :aria-label="`Lock of ${name}`">
    <!-- Two columns once the panel is wide enough: who and time | the sections -->
    <div class="ldp__grid">
      <div class="ldp__side">
        <header class="ldp__head">
          <UserAvatar class="ldp__avatar" :avatar-url="loq.loqee?.avatar_url" :display-name="loq.loqee?.display_name" />
          <div class="ldp__who">
            <h2 class="ldp__name">{{ name }}</h2>
            <p class="ldp__since">
              Locked {{ timeAgo(loq.accepted_at ?? loq.created_at) }}<template v-if="loq.emotion"> · {{ emotionEmoji(loq.emotion) }}</template>
            </p>
            <OnlineIndicator :user-id="loq.loqee?.id" :last-seen-at="loq.loqee?.last_seen_at" />
          </div>
          <button type="button" class="ldp__icon" aria-label="Open chat" @click="select('chat')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          </button>
        </header>

        <div class="ldp__clock">
          <LockCountdown hero expanded :locked-until="loq.loqed_until" :paused-at="loq.paused_at" @expired="emit('expired')" />
          <p class="ldp__ends">{{ endsLabel(loq, now) }}</p>
        </div>

        <LockTimeControls
          :paused="loq.status === 'paused'"
          :pending="pending"
          :adjust="adjust"
          @toggle-pause="emit('toggle-pause')"
          @end="emit('end')"
        />

        <Transition name="ldp-flash">
          <p v-if="flash" class="ldp__flash" role="status">{{ flash }}</p>
        </Transition>
        <p v-if="error" class="ldp__err" role="alert">{{ error }}</p>
      </div>

      <div class="ldp__main">
        <div class="ldp__tabs" role="tablist" aria-label="Lock sections" @keydown="onTabKey">
          <button
            v-for="t in tabs"
            :id="`ldp-tab-${t.key}`"
            :key="t.key"
            :ref="el => { tabEls[t.key] = el as HTMLButtonElement }"
            type="button"
            role="tab"
            class="ldp__tab"
            :class="{ 'ldp__tab--on': t.key === tab }"
            :aria-selected="t.key === tab"
            :aria-controls="`ldp-panel-${t.key}`"
            :tabindex="t.key === tab ? 0 : -1"
            @click="select(t.key)"
          >
            {{ t.label }}<span v-if="t.count" class="ldp__count">{{ t.count }}</span>
          </button>
        </div>

        <div
          :id="`ldp-panel-${tab}`"
          :key="`${loq.id}-${tab}`"
          class="ldp__panel"
          role="tabpanel"
          :aria-labelledby="`ldp-tab-${tab}`"
          tabindex="0"
        >
          <template v-if="tab === 'overview'">
            <ul class="ldp__chips" aria-label="Status">
              <li v-for="c in chips" :key="c.label" class="lock-chip" :class="`lock-chip--${c.tone}`">{{ c.label }}</li>
            </ul>
            <div class="ldp__overview">
              <LoqCheckin :loq-id="loq.id" role="keyholder" @changed="emit('changed')" />
              <div v-if="loq.combination_text || loq.combination_photo_url" class="ldp__combo">
                <p class="ldp__label">Combination</p>
                <div v-if="loq.combination_text" class="ldp__combo-row">
                  <code class="ldp__combo-val">{{ loq.combination_text }}</code>
                  <button type="button" class="ldp__copy" @click="copyCombo">{{ copied ? 'Copied' : 'Copy' }}</button>
                </div>
                <img v-else :src="loq.combination_photo_url!" alt="Combination photo" class="ldp__combo-img">
              </div>
              <slot name="share" />
            </div>
          </template>
          <LoqTasks v-else-if="tab === 'tasks'" :loq-id="loq.id" role="keyholder" @changed="emit('changed')" />
          <LoqVerification v-else-if="tab === 'proof'" :loq-id="loq.id" role="keyholder" @changed="emit('changed')" />
          <LoqChat v-else-if="tab === 'chat'" :loq-id="loq.id" :channel="channel" autofocus />
          <LoqWheel v-else-if="tab === 'wheel'" :loq-id="loq.id" role="keyholder" />
          <LoqSurprises v-else-if="tab === 'surprises'" :loq-id="loq.id" />
          <LoqHistory v-else-if="tab === 'history'" :loq-id="loq.id" />
        </div>
      </div>
    </div>
  </section>
</template>


<script setup lang="ts">
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Loq, LockSignals } from '~/types'
import { endsLabel, lockSignalChips, type LockTab } from '~/utils/lockDashboard'

type PanelLoq = Loq & Partial<LockSignals> & {
  loqee: { id: string; display_name: string | null; avatar_url: string | null; last_seen_at?: string | null } | null
}

const props = defineProps<{
  loq: PanelLoq
  tab: LockTab
  now: number
  channel: RealtimeChannel | null
  pending: boolean
  adjust: (deltaMinutes: number) => Promise<boolean>
  flash?: string
  error?: string
}>()

const emit = defineEmits<{
  'update:tab': [tab: LockTab]
  'toggle-pause': []
  'end': []
  'expired': []
  /** A module changed something; the page reloads signals and the feed. */
  'changed': []
}>()

const name = computed(() => props.loq.loqee?.display_name ?? 'Unknown')
const chips = computed(() => lockSignalChips(props.loq, 6, props.now))

const tabs = computed<{ key: LockTab; label: string; count?: number }[]>(() => [
  { key: 'overview', label: 'Overview' },
  { key: 'tasks', label: 'Tasks', count: props.loq.open_tasks?.length || undefined },
  { key: 'proof', label: 'Proof', count: props.loq.pending_verifications || undefined },
  { key: 'chat', label: 'Chat' },
  { key: 'wheel', label: 'Wheel' },
  { key: 'surprises', label: 'Surprises' },
  { key: 'history', label: 'History' },
])

const tabEls: Partial<Record<LockTab, HTMLButtonElement>> = {}

function select(key: LockTab) {
  emit('update:tab', key)
}

// Arrow keys move between tabs (WAI-ARIA tabs pattern).
function onTabKey(e: KeyboardEvent) {
  const keys = tabs.value.map(t => t.key)
  const i = keys.indexOf(props.tab)
  let next = -1
  if (e.key === 'ArrowRight') next = (i + 1) % keys.length
  else if (e.key === 'ArrowLeft') next = (i - 1 + keys.length) % keys.length
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = keys.length - 1
  if (next < 0) return
  e.preventDefault()
  select(keys[next])
  nextTick(() => tabEls[keys[next]]?.focus())
}

const copied = ref(false)
async function copyCombo() {
  if (!props.loq.combination_text) return
  await navigator.clipboard.writeText(props.loq.combination_text)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/lock-dashboard' as *;

.ldp {
  padding: 20px;
  border-radius: 20px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  min-width: 0;
  container-type: inline-size;

  &__grid { display: flex; flex-direction: column; gap: 20px; }
  &__side, &__main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }

  &__head { display: flex; align-items: center; gap: 12px; }
  &__avatar { @include avatar(48px); }
  &__who { flex: 1; min-width: 0; }
  &__name { margin: 0; font-family: var(--font-display); font-size: 20px; font-weight: 600; color: var(--color-text); overflow-wrap: anywhere; }
  &__since { margin: 2px 0; font-size: 13px; color: var(--color-text-muted); }

  &__icon {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    border: 1.5px solid var(--color-elevated);
    background: transparent;
    color: var(--color-text);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    &:hover { border-color: var(--color-accent); }
    &:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
  }

  &__clock { display: flex; flex-direction: column; gap: 8px; }
  &__ends { margin: 0; text-align: center; font-size: 13px; color: var(--color-text-muted); }

  &__flash { margin: 0; font-size: 13px; font-weight: 600; color: var(--color-accent); text-align: center; }
  &__err { margin: 0; font-size: 13px; color: var(--color-danger); }

  &__tabs {
    display: flex;
    gap: 2px;
    margin: 0 -20px;
    padding: 0 12px;
    border-bottom: 1px solid var(--color-border);
    overflow-x: auto;
    scrollbar-width: none;
  }

  &__tab {
    flex-shrink: 0;
    min-height: 44px;
    padding: 0 12px;
    border: 0;
    border-bottom: 2px solid transparent;
    background: none;
    color: var(--color-text-muted);
    font: 500 14px var(--font-sans);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;

    &:hover { color: var(--color-text); }
    &:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; }

    &--on {
      color: var(--color-text);
      font-weight: 600;
      border-bottom-color: var(--color-accent);
    }
  }

  &__count {
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    box-sizing: border-box;
    border-radius: 9px;
    background: var(--color-warn);
    color: var(--color-on-accent);
    font-size: 11px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  &__panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    &:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 4px; border-radius: 8px; }
    // The modules bring their own top margin for the old stacked layout.
    > :deep(section) { margin-top: 0; }
  }

  &__chips { @include chip-list; }

  &__label { margin: 0 0 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-text-muted); }

  &__combo-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--color-border);
  }
  &__combo-val { flex: 1; font-family: var(--font-display); font-size: 18px; font-weight: 600; color: var(--color-text); word-break: break-all; }
  &__copy { @include dash-btn; min-height: 36px; }
  &__combo-img { display: block; width: 100%; max-height: 12rem; object-fit: contain; border-radius: 10px; border: 1px solid var(--color-border); background: rgba(0, 0, 0, 0.2); }

  &__overview { display: flex; flex-direction: column; gap: 16px; }
}

// Wide panel: time on the left, the sections take the rest. The tabs then
// sit inside their column instead of running edge to edge.
@container (min-width: 860px) {
  .ldp__grid {
    display: grid;
    grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
    gap: 28px;
    align-items: start;
  }

  .ldp__side {
    position: sticky;
    top: 16px;
    padding-right: 28px;
    border-right: 1px solid var(--color-border);
  }

  .ldp__tabs { margin: 0; padding: 0; }
}

// Very wide: overview cards side by side.
@container (min-width: 1180px) {
  .ldp__overview {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}

.ldp-flash-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.ldp-flash-leave-active { transition: opacity 0.3s ease; }
.ldp-flash-enter-from { opacity: 0; transform: translateY(4px); }
.ldp-flash-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .ldp-flash-enter-active, .ldp-flash-leave-active { transition: none; }
}
</style>
