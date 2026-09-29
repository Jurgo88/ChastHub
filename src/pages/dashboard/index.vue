<template>
  <div class="redirect-state">
    <div class="spinner" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const authStore = useAuthStore()

onMounted(() => {
  if (authStore.isLoqee) {
    navigateTo('/dashboard/loqee', { replace: true })
  }
  else if (authStore.isLoqholder) {
    navigateTo('/dashboard/loqholder', { replace: true })
  }
})
</script>

<style scoped lang="scss">
.redirect-state {
  /* TASK-153 — see .dash in _loq-card.scss: the default layout owns the
     viewport height now, so claiming it here too pushed the footer a full
     screen below the content. */
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
}

.spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
