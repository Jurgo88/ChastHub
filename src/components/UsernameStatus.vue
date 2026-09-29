<script setup lang="ts">
import type { UsernameAvailability } from '~/composables/useUsernameCheck'

defineProps<{ state: UsernameAvailability }>()
</script>

<template>
  <p class="uname-status" :class="`uname-status--${state}`" aria-live="polite">
    <template v-if="state === 'checking'">Checking…</template>
    <template v-else-if="state === 'available'">✓ Available</template>
    <template v-else-if="state === 'taken'">Taken, try another one</template>
    <template v-else-if="state === 'invalid'">3 to 20 characters: lowercase letters, numbers and _, starting with a letter</template>
    <template v-else-if="state === 'error'">Could not check right now</template>
    <template v-else>3 to 20 characters: lowercase letters, numbers and _</template>
  </p>
</template>

<style scoped>
.uname-status {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-muted);
}
.uname-status--available { color: var(--color-success); font-weight: 600; }
.uname-status--taken,
.uname-status--invalid { color: var(--color-danger); }
</style>
