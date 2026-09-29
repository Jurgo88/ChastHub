<script setup lang="ts">
// Role picker used by signup and the Google OAuth completion step.
// Values are the DB roles; labels are the UI words.
import type { UserRole } from '~/types'

const role = defineModel<UserRole | null>({ required: true })
</script>

<template>
  <div class="roles" role="radiogroup" aria-label="Choose your role">
    <button
      type="button"
      role="radio"
      class="roles__card"
      :class="{ 'roles__card--on': role === 'loqee' }"
      :aria-checked="role === 'loqee'"
      @click="role = 'loqee'"
    >
      <span class="roles__top">
        <svg class="roles__icon" viewBox="0 0 24 24" fill="none" stroke="#F25A93" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2.5" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /><circle cx="12" cy="16" r="1.4" /></svg>
        <span class="roles__tag roles__tag--pink">30 days free</span>
      </span>
      <span class="roles__label">Wearer</span>
      <span class="roles__desc">I hand over the key and someone else controls my timer.</span>
    </button>

    <button
      type="button"
      role="radio"
      class="roles__card"
      :class="{ 'roles__card--on': role === 'loqholder' }"
      :aria-checked="role === 'loqholder'"
      @click="role = 'loqholder'"
    >
      <span class="roles__top">
        <svg class="roles__icon" viewBox="0 0 24 24" fill="none" stroke="#FB773C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="4.5" /><path d="M11.2 11.2 20 20" /><path d="m16 16 2-2" /><path d="m18.5 18.5 2-2" /></svg>
        <span class="roles__tag roles__tag--orange">Always free</span>
      </span>
      <span class="roles__label">Keyholder</span>
      <span class="roles__desc">I hold the key and decide when they're free.</span>
    </button>
  </div>
</template>

<style scoped lang="scss">
.roles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.roles__card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 18px;
  border-radius: 18px;
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  text-align: left;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, transform 0.15s;

  &:hover { border-color: var(--color-elevated); }
  &--on {
    border-color: var(--color-accent);
    background: linear-gradient(160deg, rgba(var(--color-brand-rgb), 0.18) 0%, var(--color-surface) 70%);
    box-shadow: 0 0 0 4px rgba(var(--color-accent-rgb), 0.15);
  }
}
.roles__top { width: 100%; display: flex; align-items: center; justify-content: space-between; }
.roles__icon { width: 34px; height: 34px; }
.roles__tag {
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  &--pink { background: rgba(var(--color-accent-rgb), 0.16); color: var(--color-accent); }
  &--orange { background: rgba(var(--color-cta-rgb), 0.16); color: var(--color-cta); }
}
.roles__label { font-family: var(--font-display); font-size: 21px; font-weight: 700; letter-spacing: -0.01em; }
.roles__desc { font-size: 14px; line-height: 1.45; color: var(--color-text-muted); }

@media (max-width: 380px) {
  .roles { grid-template-columns: minmax(0, 1fr); }
}
</style>
