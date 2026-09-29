<script setup lang="ts">
import type { Loq, VisitorPermission } from '~/types'

// TASK-142 — the owner's controls for an unpaired loq: whether it is listed
// in Discover, and what a visitor's vote is allowed to do to the clock.
//
// Two separate decisions on purpose. Before this, publishing meant accepting
// that strangers could move your time; 'Nobody' is the state that was
// missing. It is also what every loq migrated out of the old queue starts
// on, since those owners never agreed to time votes.
//
// Rendered for self-loqs and for loqs still looking for a loqholder. Once a
// loqholder takes the key the loq leaves Discover — the clock is theirs.
const props = defineProps<{ loq: Loq }>()
const emit = defineEmits<{ updated: [Partial<Loq>]; error: [string] }>()

const { setDiscoverListing, setVisitorAmount, setVisitorPermission } = useLoq()

const listingPending = ref(false)
const amountPending = ref(false)
const permissionPending = ref(false)

// TASK-059 presets, plus 'Nobody' (TASK-142).
const VISITOR_PRESETS = [
  { label: '15m', hours: 0.25 },
  { label: '1h', hours: 1 },
  { label: '6h', hours: 6 },
  { label: '1d', hours: 24 },
  { label: '3d', hours: 72 },
]

const VISITOR_PERMISSIONS: { label: string; value: VisitorPermission }[] = [
  { label: 'Nobody', value: 'none' },
  { label: 'Add only', value: 'add' },
  { label: 'Remove only', value: 'remove' },
  { label: 'Both', value: 'both' },
]

const permission = computed<VisitorPermission>(() => props.loq.visitor_permission ?? 'both')

async function toggleListing() {
  listingPending.value = true
  try {
    const updated = await setDiscoverListing(props.loq.id, !props.loq.listed_in_discover)
    emit('updated', {
      listed_in_discover: updated.listed_in_discover,
      public_link_id: updated.public_link_id,
    })
  }
  catch (err) { emit('error', (err as Error).message) }
  finally { listingPending.value = false }
}

async function pickAmount(hours: number) {
  amountPending.value = true
  try {
    const { visitor_add_hours } = await setVisitorAmount(props.loq.id, hours)
    emit('updated', { visitor_add_hours })
  }
  catch (err) { emit('error', (err as Error).message) }
  finally { amountPending.value = false }
}

async function pickPermission(value: VisitorPermission) {
  permissionPending.value = true
  try {
    const { visitor_permission } = await setVisitorPermission(props.loq.id, value)
    emit('updated', { visitor_permission: visitor_permission as VisitorPermission })
  }
  catch (err) { emit('error', (err as Error).message) }
  finally { permissionPending.value = false }
}
</script>

<template>
  <div class="discover-controls">
    <div class="discover-controls__row">
      <div class="discover-controls__text">
        <span class="discover-controls__title">Show in Discover</span>
        <span class="discover-controls__hint">
          Anyone signed in can find your lock. What they may do to the clock is up to you, below.
        </span>
      </div>
      <button
        class="btn btn--sm"
        :class="loq.listed_in_discover ? 'btn--ghost' : 'btn--primary'"
        :disabled="listingPending"
        @click="toggleListing"
      >
        {{ listingPending ? '…' : (loq.listed_in_discover ? 'Remove' : 'Show') }}
      </button>
    </div>

    <template v-if="loq.listed_in_discover">
      <div class="visitor-amount">
        <p class="visitor-amount__caption">Visitors can</p>
        <div class="combo-toggle">
          <button
            v-for="perm in VISITOR_PERMISSIONS"
            :key="perm.value"
            type="button"
            class="combo-toggle__btn"
            :class="{ 'combo-toggle__btn--active': permission === perm.value }"
            :disabled="permissionPending"
            @click="pickPermission(perm.value)"
          >{{ perm.label }}</button>
        </div>
      </div>

      <div v-if="permission !== 'none'" class="visitor-amount">
        <p class="visitor-amount__caption">Each vote changes the timer by</p>
        <div class="combo-toggle">
          <button
            v-for="preset in VISITOR_PRESETS"
            :key="preset.hours"
            type="button"
            class="combo-toggle__btn"
            :class="{ 'combo-toggle__btn--active': loq.visitor_add_hours === preset.hours }"
            :disabled="amountPending"
            @click="pickAmount(preset.hours)"
          >{{ preset.label }}</button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/styles/loq-card' as *;
@use '~/assets/styles/shared-ui' as *;

.discover-controls {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding-top: 0.875rem;
  border-top: 1px solid var(--color-border);

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
    flex: 1;
  }

  &__title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text);
  }

  &__hint {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
}

// Lifted from dashboard/loqee.vue, where these controls used to live inline.
// Its styles are scoped, so they do not reach a child component.
.visitor-amount {
  &__caption {
    font-size: 0.75rem;
    color: var(--color-muted);
    margin: 0 0 0.375rem;
  }
}

.combo-toggle {
  display: flex;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-sm, 0.5rem);
  overflow: hidden;
  width: fit-content;
  flex-wrap: wrap;

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
      color: #fff;
    }
  }
}
</style>
