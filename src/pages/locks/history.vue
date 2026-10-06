<template>
  <div class="lh-page">
    <AppNav />

    <main class="lh-wrap">
      <header class="lh-head">
        <h1>Lock history</h1>
        <p>Your finished locks, newest first.</p>
      </header>

      <p v-if="loading" class="lh-note">Loading…</p>
      <p v-else-if="error" class="lh-note lh-note--err">{{ error }}</p>
      <p v-else-if="!locks.length" class="lh-note">No finished locks yet. When a lock ends, it shows up here.</p>

      <ul v-else class="lh-list">
        <li v-for="l in locks" :key="l.id" class="lh-card">
          <button type="button" class="lh-card__top" :aria-expanded="openId === l.id" @click="toggle(l.id)">
            <span class="lh-card__big">{{ formatHours(l.summary.total_hours) }}</span>
            <span class="lh-card__meta">
              <strong>{{ l.role === 'wearer' ? 'Worn' : 'Held' }}<template v-if="l.with"> {{ l.role === 'wearer' ? 'with' : 'for' }} {{ l.with }}</template><template v-else> solo</template></strong>
              <small>{{ formatDate(l.created_at) }}</small>
            </span>
            <span class="lh-pill" :class="`lh-pill--${l.summary.outcome}`">{{ OUTCOME_LABEL[l.summary.outcome] }}</span>
          </button>

          <div v-if="openId === l.id" class="lh-detail">
            <dl class="lh-stats">
              <div><dt>Keyholder added</dt><dd>{{ formatHours(l.summary.keyholder_added_hours) }}</dd></div>
              <div><dt>Visitors added</dt><dd>{{ formatHours(l.summary.visitor_added_hours) }}</dd></div>
              <div><dt>Visitors</dt><dd>{{ l.summary.visitors }}</dd></div>
              <div><dt>Pauses</dt><dd>{{ l.summary.pauses }}</dd></div>
              <div><dt>Longest stretch</dt><dd>{{ formatHours(l.summary.longest_stretch_hours) }}</dd></div>
            </dl>

            <button type="button" class="lh-share" :disabled="sharing === l.id" @click="share(l)">
              {{ sharing === l.id ? 'Preparing…' : 'Share' }}
            </button>
            <p v-if="shareError" class="lh-note lh-note--err">{{ shareError }}</p>

            <p v-if="timelineLoading" class="lh-note">Loading…</p>
            <ol v-else class="lh-timeline">
              <li v-for="(e, i) in timeline" :key="`${e.type}-${e.at}-${i}`">
                <span class="lh-timeline__icon" aria-hidden="true">{{ describeEvent(e).icon }}</span>
                <span>
                  {{ describeEvent(e).text }}
                  <time :datetime="e.at">{{ whenLabel(e.at) }}</time>
                </span>
              </li>
            </ol>
          </div>
        </li>
      </ul>
    </main>
  </div>
</template>

<script setup lang="ts">
import { describeEvent, formatHours, OUTCOME_LABEL, whenLabel, type HistoryEventView, type LockSummaryView } from '~/utils/lockHistory'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'Lock history · ChastHub' })

interface ArchiveLock {
  id: string
  created_at: string
  role: 'wearer' | 'keyholder'
  with: string | null
  summary: LockSummaryView
}

const { authFetch } = useAuthFetch()
const { formatDate } = useFormatters()

const locks = ref<ArchiveLock[]>([])
const loading = ref(true)
const error = ref('')
const openId = ref<string | null>(null)
const timeline = ref<HistoryEventView[]>([])
const timelineLoading = ref(false)
const sharing = ref<string | null>(null)
const shareError = ref('')

onMounted(async () => {
  try {
    locks.value = (await authFetch<{ locks: ArchiveLock[] }>('/api/locks/history')).locks
  }
  catch {
    error.value = 'Could not load your history.'
  }
  finally {
    loading.value = false
  }
})

async function toggle(id: string) {
  shareError.value = ''
  if (openId.value === id) { openId.value = null; return }
  openId.value = id
  timeline.value = []
  timelineLoading.value = true
  try {
    timeline.value = (await authFetch<{ events: HistoryEventView[] }>(`/api/loqs/${id}/history`)).events
  }
  catch {
    shareError.value = 'Could not load the timeline.'
  }
  finally {
    timelineLoading.value = false
  }
}

// The image sits behind the login, so fetch it with the token and hand the
// bytes to the share sheet (or save them where there is none).
async function share(l: ArchiveLock) {
  sharing.value = l.id
  shareError.value = ''
  try {
    const blob = await authFetch<Blob>(`/api/loqs/${l.id}/share-image`, { responseType: 'blob' })
    const file = new File([blob], 'chasthub-lock.png', { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: `${formatHours(l.summary.total_hours)} locked on ChastHub` })
    }
    else {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      URL.revokeObjectURL(url)
    }
  }
  catch (e) {
    if ((e as Error).name !== 'AbortError') shareError.value = 'Could not create the image.'
  }
  finally {
    sharing.value = null
  }
}
</script>

<style scoped lang="scss">
.lh-page { min-height: 100vh; }
.lh-wrap { max-width: 720px; margin: 0 auto; padding: 24px 16px 64px; }
.lh-head {
  margin-bottom: 20px;
  h1 { margin: 0 0 4px; font: 700 28px var(--font-display); }
  p { margin: 0; color: var(--color-text-muted); }
}
.lh-note { margin: 0; font-size: 14px; color: var(--color-text-muted); &--err { color: var(--color-cta); } }

.lh-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 12px; }

.lh-card {
  border-radius: 20px;
  background: rgba(24, 1, 97, 0.8);
  border: 1px solid var(--color-border);
  overflow: hidden;

  &__top {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px;
    background: none;
    border: 0;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  &__big { font: 700 26px var(--font-display); font-variant-numeric: tabular-nums; white-space: nowrap; }
  &__meta { flex: 1; min-width: 0; display: flex; flex-direction: column; strong { font-size: 14px; } small { color: var(--color-text-muted); } }
}

.lh-pill {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  background: var(--color-elevated);
  white-space: nowrap;

  &--completed { color: var(--color-accent); }
  &--ended_early { color: var(--color-cta); }
}

.lh-detail { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 14px; }

.lh-stats {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;

  div { padding: 10px; border-radius: 12px; background: var(--color-elevated); }
  dt { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-text-muted); }
  dd { margin: 2px 0 0; font: 700 18px var(--font-display); }
}

.lh-share {
  align-self: flex-start;
  padding: 10px 22px;
  border: 0;
  border-radius: 999px;
  background: var(--gradient-brand);
  color: var(--color-on-accent);
  font-weight: 700;
  cursor: pointer;

  &:disabled { opacity: 0.6; cursor: default; }
}

.lh-timeline {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;

  li { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; }
  time { display: block; font-size: 12px; color: var(--color-text-muted); }
  &__icon { width: 28px; flex-shrink: 0; text-align: center; }
}
</style>
