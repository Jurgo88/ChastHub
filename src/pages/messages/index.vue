<template>
  <div class="dm-empty">
    <div class="dm-empty__icon" aria-hidden="true">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
    </div>
    <h2>Your messages</h2>
    <p>Pick a conversation on the left, or start a new one with a keyholder or wearer you have found.</p>
    <div class="dm-empty__actions">
      <button class="pbtn pbtn--primary" type="button" @click="inbox.showNew.value = true">New message</button>
      <NuxtLink to="/keydrop" class="pbtn">Browse Key Drop</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
// Right pane when no conversation is open. Hidden on phones, where the list
// takes the whole screen.
const inbox = useDmInbox()
</script>

<style scoped lang="scss">
@use '~/assets/styles/profile' as *;

.dm-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 24px;
  text-align: center;
  background: linear-gradient(180deg, rgba(14, 0, 51, 0.35), rgba(14, 0, 51, 0.7));

  &__icon {
    width: 72px;
    height: 72px;
    border-radius: 24px;
    display: grid;
    place-items: center;
    color: var(--color-accent);
    background: rgba(var(--color-accent-rgb), 0.12);
    border: 1px solid rgba(var(--color-accent-rgb), 0.35);
    margin-bottom: 6px;
  }

  h2 { margin: 0; font: 700 22px var(--font-display); }
  p { margin: 0; max-width: 360px; color: var(--color-text-muted); line-height: 1.5; font-size: 14px; }

  &__actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 10px; }
}
</style>
