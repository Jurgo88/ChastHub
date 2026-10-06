<template>
  <section v-if="summary" class="fc" aria-label="Lock summary">
    <p class="fc__label">{{ OUTCOME_LABEL[summary.outcome] }}</p>
    <p class="fc__big">{{ spanHours(summary.total_hours) }}</p>
    <p class="fc__sub">locked</p>

    <dl class="fc__stats">
      <div v-if="added > 0"><dt>Time added</dt><dd>+{{ spanHours(added) }}</dd></div>
      <div v-if="summary.visitors > 0"><dt>Visitors</dt><dd>{{ summary.visitors }}</dd></div>
      <div><dt>Pauses</dt><dd>{{ summary.pauses }}</dd></div>
      <div><dt>Longest stretch</dt><dd>{{ spanHours(summary.longest_stretch_hours) }}</dd></div>
      <div v-if="summary.reactions"><dt>Reactions</dt><dd>{{ summary.reactions }}</dd></div>
    </dl>

    <div class="fc__actions">
      <button type="button" class="fc__btn fc__btn--primary" :disabled="sharing" @click="shareLock(loqId, summary.total_hours)">
        {{ sharing ? 'Preparing…' : 'Share' }}
      </button>
      <NuxtLink to="/lock/create" class="fc__btn">Lock again</NuxtLink>
    </div>
    <p v-if="error" class="fc__err">{{ error }}</p>
  </section>
</template>

<script setup lang="ts">
import { spanHours, OUTCOME_LABEL, type LockSummaryView } from '~/utils/lockHistory'

const props = defineProps<{ loqId: string }>()

const { authFetch } = useAuthFetch()
const { shareLock, sharing, error } = useLockShare()
const summary = ref<(LockSummaryView & { reactions?: number }) | null>(null)

const added = computed(() => (summary.value ? summary.value.keyholder_added_hours + summary.value.visitor_added_hours : 0))

onMounted(async () => {
  try {
    summary.value = await authFetch(`/api/loqs/${props.loqId}/summary`)
  }
  catch {
    summary.value = null
  }
})
</script>

<style scoped lang="scss">
.fc {
  width: 100%;
  max-width: 420px;
  padding: 20px 16px;
  border-radius: 20px;
  text-align: center;
  background: rgba(24, 1, 97, 0.85);
  border: 1px solid var(--color-border);

  &__label { margin: 0; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-text-muted); }
  &__big { margin: 4px 0 0; font: 700 44px var(--font-display); letter-spacing: -0.02em; }
  &__sub { margin: 0 0 14px; color: var(--color-text-muted); }

  &__stats {
    margin: 0 0 16px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 8px;

    div { padding: 10px; border-radius: 12px; background: var(--color-elevated); }
    dt { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-text-muted); }
    dd { margin: 2px 0 0; font: 700 18px var(--font-display); }
  }

  &__actions { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }

  &__btn {
    padding: 10px 22px;
    border-radius: 999px;
    border: 1.5px solid var(--color-border);
    background: transparent;
    color: var(--color-text);
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;

    &--primary { border: 0; background: var(--gradient-brand); color: var(--color-on-accent); }
    &:disabled { opacity: 0.6; cursor: default; }
  }

  &__err { margin: 10px 0 0; font-size: 13px; color: var(--color-cta); }
}
</style>
