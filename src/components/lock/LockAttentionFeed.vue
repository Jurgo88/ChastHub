<template>
  <section class="laf" aria-labelledby="laf-title">
    <div class="laf__head">
      <h2 id="laf-title" class="laf__title">Needs you now</h2>
      <span v-if="items.length" class="laf__count">{{ items.length }}</span>
      <span v-if="items.length > 1" class="laf__hint">Oldest first</span>
    </div>

    <p v-if="!items.length" class="laf__empty">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
      All caught up. Nothing is waiting on you.
    </p>

    <ul v-else class="laf__list" :class="{ 'laf__list--stacked': items.length > 1 }">
      <li
        v-for="(item, i) in items"
        :key="`${item.kind}-${item.id}`"
        class="laf__item"
        :class="{ 'laf__item--current': i === current }"
      >
        <article class="laf__card">
          <div class="laf__icon" :class="`laf__icon--${item.kind}`" aria-hidden="true">
            <svg v-if="item.kind === 'verification'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
            <svg v-else-if="item.kind === 'task'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
            <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></svg>
          </div>

          <div class="laf__body">
            <p class="laf__stackpos" aria-hidden="true">{{ i + 1 }} of {{ items.length }}</p>
            <p class="laf__what">{{ title(item) }}</p>
            <p class="laf__meta">{{ meta(item) }}</p>
            <p v-if="item.kind === 'task' && item.proof_text" class="laf__proof">“{{ item.proof_text }}”</p>
            <p v-if="item.kind === 'request' && item.reason" class="laf__proof">“{{ item.reason }}”</p>

            <button
              v-if="item.photo_url"
              type="button"
              class="laf__thumb"
              :aria-label="`Open the photo from ${person(item)}`"
              @click="lightbox = item.photo_url"
            >
              <img :src="item.photo_url" alt="" loading="lazy">
            </button>

            <div class="laf__actions">
              <template v-if="item.kind === 'verification'">
                <button type="button" class="laf__btn laf__btn--primary" :disabled="busy === item.id" @click="reviewVerification(item)">Approve</button>
                <button type="button" class="laf__btn" @click="emit('open', item, 'proof')">Review</button>
              </template>
              <template v-else-if="item.kind === 'task'">
                <button type="button" class="laf__btn laf__btn--primary" :disabled="busy === item.id" @click="reviewTask(item, 'done')">Done</button>
                <button type="button" class="laf__btn" :disabled="busy === item.id" @click="reviewTask(item, 'failed')">Failed</button>
              </template>
              <template v-else>
                <button type="button" class="laf__btn laf__btn--primary" :disabled="busyRequest === item.loq_id" @click="emit('accept-request', item)">Accept</button>
                <button type="button" class="laf__btn" :disabled="busyRequest === item.loq_id" @click="emit('reject-request', item)">Decline</button>
              </template>
              <button v-if="items.length > 1" type="button" class="laf__btn laf__btn--skip" @click="skip">Skip</button>
            </div>
            <p v-if="errors[item.id]" class="laf__err" role="alert">{{ errors[item.id] }}</p>
          </div>
        </article>
      </li>
    </ul>

    <ImageLightbox v-if="lightbox" :src="lightbox" alt="Proof photo" @close="lightbox = ''" />
  </section>
</template>

<script setup lang="ts">
import type { AttentionItem } from '~/types'
import { spanMinutes } from '~/utils/lockHistory'

const props = defineProps<{
  items: AttentionItem[]
  /** Lock id of a request being accepted or declined by the page. */
  busyRequest?: string | null
}>()

const emit = defineEmits<{
  'open': [item: AttentionItem, tab: 'proof' | 'tasks']
  'accept-request': [item: AttentionItem]
  'reject-request': [item: AttentionItem]
  /** Something was settled here; the page reloads its data. */
  'changed': []
}>()

const { authFetch } = useAuthFetch()
const busy = ref<string | null>(null)
const errors = reactive<Record<string, string>>({})
const lightbox = ref('')
// On a phone only one card shows at a time (a stack); Skip moves on.
const current = ref(0)

watch(() => props.items.length, (n) => { if (current.value >= n) current.value = 0 })

function skip() {
  current.value = (current.value + 1) % props.items.length
}

const person = (i: AttentionItem) => i.loqee?.display_name ?? 'Your wearer'

function title(i: AttentionItem): string {
  if (i.kind === 'verification') return `${person(i)} sent a verification photo`
  if (i.kind === 'task') return `${person(i)} finished “${i.text}”`
  return `New request from ${person(i)}`
}

function meta(i: AttentionItem): string {
  const ago = timeAgo(i.at)
  if (i.kind === 'verification') return `Code ${i.code} · ${ago}`
  if (i.kind === 'task') {
    const parts = [i.proof === 'none' ? 'No proof needed' : i.photo_url ? 'Photo attached' : 'Proof attached']
    if (i.reward_minutes) parts.push(`reward −${spanMinutes(i.reward_minutes)}`)
    parts.push(ago)
    return parts.join(' · ')
  }
  return `${formatDuration(i.duration_minutes ?? 0)} · ${ago}`
}

async function settle(item: AttentionItem, path: string, body: Record<string, unknown>) {
  busy.value = item.id
  delete errors[item.id]
  try {
    await authFetch(`/api/loqs/${item.loq_id}/${path}`, { method: 'POST', body })
    emit('changed')
  }
  catch (e) {
    errors[item.id] = (e as { data?: { message?: string } }).data?.message ?? 'Could not save. Try again.'
  }
  finally {
    busy.value = null
  }
}

const reviewVerification = (item: AttentionItem) =>
  settle(item, `verifications/${item.id}/review`, { decision: 'approve' })

const reviewTask = (item: AttentionItem, decision: 'done' | 'failed') =>
  settle(item, `tasks/${item.id}/review`, { decision })
</script>

<style scoped lang="scss">
@use '~/assets/styles/lock-dashboard' as *;

.laf {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__head { display: flex; align-items: center; gap: 10px; }
  &__title { margin: 0; font-family: var(--font-display); font-size: 18px; font-weight: 600; color: var(--color-text); }

  &__count {
    min-width: 24px;
    height: 24px;
    padding: 0 8px;
    box-sizing: border-box;
    border-radius: 12px;
    background: var(--color-cta);
    color: var(--color-on-accent);
    font-size: 12px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  &__hint { font-size: 13px; color: var(--color-text-muted); }

  &__empty {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-radius: 14px;
    border: 1px dashed var(--color-border);
    color: var(--color-text-muted);
    font-size: 14px;
    svg { color: var(--color-success); flex-shrink: 0; }
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 12px;
  }

  &__card {
    height: 100%;
    box-sizing: border-box;
    display: flex;
    gap: 14px;
    padding: 16px;
    border-radius: 16px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
  }

  &__icon {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: var(--color-elevated);
    color: var(--color-warn);
    display: flex;
    align-items: center;
    justify-content: center;

    &--request { color: var(--color-cta); }
  }

  &__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  &__stackpos { display: none; margin: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-warn); }
  &__what { margin: 0; font-weight: 600; color: var(--color-text); overflow-wrap: anywhere; }
  &__meta { margin: 0; font-size: 13px; color: var(--color-text-muted); }
  &__proof { margin: 4px 0 0; font-size: 13px; font-style: italic; color: #CFC5F2; overflow-wrap: anywhere; }

  &__thumb {
    margin-top: 6px;
    width: 96px;
    height: 72px;
    padding: 0;
    border-radius: 10px;
    border: 1px solid var(--color-border);
    overflow: hidden;
    background: var(--color-bg);
    cursor: zoom-in;
    img { width: 100%; height: 100%; object-fit: cover; display: block; }
    &:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
  }

  &__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }

  &__btn {
    @include dash-btn;
    min-height: 36px;

    &--primary {
      background: var(--color-accent);
      border-color: var(--color-accent);
      color: var(--color-on-accent);
      &:hover:not(:disabled) { filter: brightness(1.06); }
    }

    &--skip { display: none; margin-left: auto; border-color: transparent; color: var(--color-text-muted); }
  }

  &__err { margin: 4px 0 0; font-size: 13px; color: var(--color-danger); }
}

// Phone: a stack of cards, one shown at a time, the rest peeking out below.
@media (max-width: 639px) {
  .laf__list--stacked {
    display: block;
    padding-bottom: 16px;
    position: relative;

    &::before,
    &::after {
      content: '';
      position: absolute;
      left: 16px;
      right: 16px;
      bottom: 0;
      height: 24px;
      border-radius: 0 0 16px 16px;
      background: var(--color-border);
    }
    &::after { left: 8px; right: 8px; bottom: 8px; background: var(--color-elevated); }

    .laf__item { display: none; position: relative; z-index: 1; }
    .laf__item--current { display: block; }
    .laf__card { border-color: rgba(var(--color-warn-rgb), 0.6); }
    .laf__stackpos { display: block; }
    .laf__btn--skip { display: inline-flex; }
  }
}
</style>
