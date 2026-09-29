<script setup lang="ts">
// TASK-111 — the page had no title and no headings of any kind. It stays
// noindex (see routeRules) and out of the sitemap until there is a real shop:
// a two-line placeholder is not something to put in front of Google while the
// site is still establishing trust.
useSeoMeta({
  title: 'Shop',
  description: 'The ChastHub shop is on its way.',
  robots: 'noindex, follow',
})
</script>

<template>
  <div class="dash">
    <AppNav />

    <div class="dash-state">
      <div class="dash-state__icon">👀</div>
      <h1 class="dash-state__title">Shop coming soon</h1>
      <p class="dash-state__hint">We're working on the ChastHub shop. Check back soon.</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
// The placeholder title was a <p> and is an <h1> now, purely so the document
// has a heading. No style change needed: .dash-state__title in _loq-card.scss
// already sets font-size, font-weight and margin, so it renders identically.
@use '~/assets/styles/loq-card' as *;
@use '~/assets/styles/shared-ui' as *;
</style>
