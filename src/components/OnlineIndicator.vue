<template>
  <span v-if="online" class="online-indicator online-indicator--online">
    <span class="online-indicator__dot" />
    Online
  </span>
  <span v-else-if="lastSeenText" class="online-indicator online-indicator--offline">
    {{ lastSeenText }}
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{
  userId: string | null | undefined
  lastSeenAt: string | null | undefined
}>()

const { isOnline } = useOnlinePresence()

const online = computed(() => isOnline(props.userId))

const lastSeenText = computed(() => {
  if (online.value || !props.lastSeenAt) return ''
  const diffMs = Date.now() - new Date(props.lastSeenAt).getTime()
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return 'Last seen just now'
  if (min < 60) return `Last seen ${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `Last seen ${h}h ago`
  return `Last seen ${Math.floor(h / 24)}d ago`
})
</script>

<style scoped lang="scss">
.online-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  font-weight: 600;

  &--online {
    color: #22c55e;
  }

  &--offline {
    color: var(--color-muted);
    font-weight: 500;
  }

  &__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 4px #22c55e;
    flex-shrink: 0;
  }
}
</style>
