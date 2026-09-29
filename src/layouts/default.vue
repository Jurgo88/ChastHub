<template>
  <div class="layout">
    <div class="layout__content">
      <slot />
    </div>
    <AppFooter v-if="showFooter" />
  </div>
</template>

<script setup lang="ts">
// TASK-153 — opt-out rather than opt-in: the footer belongs on every page by
// default, and the pages that cannot take one should have to say so.
//
// Today that is only the conversation view, which is a full-height chat with a
// composer pinned to the bottom. A footer underneath reads as a layout bug in
// the installed app, where there is no browser chrome to explain it.
const route = useRoute()
const showFooter = computed(() => route.meta.footer !== false)
</script>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Takes the slack, which is what pins the footer to the bottom of a short page
   instead of leaving it halfway up the screen. */
.layout__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
</style>
