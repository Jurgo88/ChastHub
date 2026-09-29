<script setup lang="ts">
// Small, self-contained marker shown next to a username wherever an admin
// (ChastHub staff) appears to other users — messages, DM header, etc. Colours
// match the shared .role-badge--admin variant so the language stays consistent.
withDefaults(defineProps<{ label?: string }>(), { label: 'Admin' })
</script>

<template>
  <span class="admin-badge" title="ChastHub admin">
    <svg class="admin-badge__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3Z"
        fill="currentColor"
        opacity="0.22"
      />
      <path
        d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <path
        d="m9 12 2 2 4-4"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    <span class="admin-badge__label">{{ label }}</span>
  </span>
</template>

<style scoped lang="scss">
.admin-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.4;
  white-space: nowrap;
  vertical-align: middle;
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;

  &__icon {
    width: 0.72rem;
    height: 0.72rem;
  }
}
</style>
