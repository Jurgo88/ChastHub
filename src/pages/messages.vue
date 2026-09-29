<template>
  <div class="dash dm-page">
    <AppNav />

    <div class="dm" :class="{ 'dm--thread': hasThread }">
      <DmList class="dm__list" :active-id="activeId" />
      <section class="dm__pane">
        <NuxtPage :page-key="(r) => r.fullPath" />
      </section>
    </div>

    <DmNewMessage v-if="inbox.showNew.value" @close="inbox.showNew.value = false" />
  </div>
</template>

<script setup lang="ts">
// Two panes on desktop: the list stays mounted on the left while the thread on
// the right changes with the child route. On a phone only one pane shows: the
// list at /messages, the thread at /messages/<id>.
definePageMeta({ middleware: 'auth', footer: false })
useHead({ title: 'Messages' })

const route = useRoute()
const inbox = provideDmInbox()

const activeId = computed(() => (route.params.id as string | undefined) ?? null)
const hasThread = computed(() => !!activeId.value)

let timer: ReturnType<typeof setInterval> | null = null
function onVisible() { if (document.visibilityState === 'visible') inbox.reload() }

onMounted(() => {
  inbox.reload()
  // Threads you are not looking at have no live channel; a light poll keeps
  // the list and the unread dots fresh.
  timer = setInterval(() => { if (document.visibilityState === 'visible') inbox.reload() }, 25_000)
  document.addEventListener('visibilitychange', onVisible)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<style scoped lang="scss">
@use '~/assets/styles/loq-card' as *;

.dm-page {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  height: 100dvh;
  overflow: hidden;
}

.dm {
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: 1200px;
  margin: 18px auto;
  padding: 0 20px;
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);

  &__list,
  &__pane {
    min-height: 0;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
  }

  &__list { border-radius: 26px 0 0 26px; border-right: 0; }

  &__pane {
    display: flex;
    flex-direction: column;
    border-radius: 0 26px 26px 0;
    overflow: hidden;
  }
}

@media (max-width: 820px) {
  .dm {
    margin: 0;
    padding: 0;
    grid-template-columns: minmax(0, 1fr);

    &__list,
    &__pane { border-radius: 0; border: 0; }

    &__pane { display: none; }

    &--thread {
      .dm__list { display: none; }
      .dm__pane { display: flex; }
    }
  }
}
</style>
