<template>
  <span v-if="msg.kind === 'system'" class="sys">{{ msg.content }}</span>

  <div v-else class="m" :class="{ 'm--team': msg.author?.team, 'm--own': own, 'm--menu': menuOpen }">
    <component :is="profileLink ? NuxtLink : 'span'" :to="profileLink" class="m__av">
      <UserAvatar class="m__img" :avatar-url="msg.author?.avatar_url" :display-name="msg.author?.display_name" />
    </component>
    <div class="m__body">
      <div class="m__top">
        <component :is="profileLink ? NuxtLink : 'b'" :to="profileLink" class="m__name">{{ name }}</component>
        <span v-if="msg.author?.team" class="tag tag--team">TEAM</span>
        <span v-if="msg.author?.lock_day" class="tag tag--day">DAY {{ msg.author.lock_day }} 🔒</span>
        <span v-if="!msg.author?.team && role" class="tag tag--role">{{ role }}</span>
        <time :datetime="msg.created_at">{{ time }}</time>
      </div>
      <div v-if="msg.reply_to" class="m__reply">↳ reply to <b>{{ msg.reply_to.name }}</b></div>
      <div v-else-if="msg.question_day" class="m__reply m__reply--q">↳ answer to the question of the day</div>
      <div class="m__txt">{{ msg.content }}</div>
    </div>

    <div class="act">
      <button v-if="canWrite" type="button" @click="$emit('reply', msg)">Reply</button>
      <button type="button" aria-label="More" :aria-expanded="menuOpen" @click.stop="menuOpen = !menuOpen">⋯</button>
      <div v-if="menuOpen" class="act__menu" role="menu" @click="menuOpen = false">
        <button v-if="canWrite" type="button" role="menuitem" @click="$emit('reply', msg)">Reply</button>
        <button v-if="!own && msg.author" type="button" role="menuitem" class="danger" @click="$emit('report', msg)">Report</button>
        <button v-if="own || moderator" type="button" role="menuitem" class="danger" @click="$emit('delete', msg)">Delete</button>
        <template v-if="moderator && !own && msg.author && !msg.author.team">
          <button type="button" role="menuitem" @click="$emit('mute', msg, 24)">Mute for 24h</button>
          <button type="button" role="menuitem" @click="$emit('mute', msg, 24 * 7)">Mute for 7 days</button>
        </template>
        <NuxtLink v-if="profileLink" :to="profileLink" role="menuitem">View profile</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LoungeMessage } from '~/types'
import { roleLabel } from '~/utils/profileLabels'
import { clockTime } from '~/utils/dmFormat'

const props = defineProps<{ msg: LoungeMessage; meId: string | undefined; moderator: boolean; canWrite: boolean }>()
defineEmits<{ reply: [LoungeMessage]; report: [LoungeMessage]; delete: [LoungeMessage]; mute: [LoungeMessage, number] }>()

const NuxtLink = resolveComponent('NuxtLink')
const menuOpen = ref(false)

const own = computed(() => !!props.meId && props.msg.author?.id === props.meId)
const name = computed(() => props.msg.author?.display_name ?? props.msg.author?.username ?? 'Deleted user')
const profileLink = computed(() => props.msg.author?.username ? `/user/${props.msg.author.username}` : undefined)
const role = computed(() => {
  const r = roleLabel(props.msg.author?.role)
  return r === 'Wearer' || r === 'Keyholder' ? r.toUpperCase() : ''
})
const time = computed(() => clockTime(props.msg.created_at))

function close() { menuOpen.value = false }
onMounted(() => document.addEventListener('click', close))
onBeforeUnmount(() => document.removeEventListener('click', close))
</script>

<style scoped lang="scss">
.sys {
  align-self: center;
  max-width: 92%;
  margin: 8px 0;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(61, 220, 151, 0.08);
  border: 1px solid rgba(61, 220, 151, 0.25);
  font-size: 12px;
  color: #BFF5DC;
  text-align: center;
}

.m {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 5px 0;

  &:hover .act, &--menu .act { opacity: 1; }

  &__av { flex-shrink: 0; width: 36px; height: 36px; margin-top: 2px; }
  &__img { display: block; width: 36px; height: 36px; border-radius: 50%; }

  // The message itself: a card as wide as its text, capped for long lines.
  &__body {
    flex: 0 1 auto;
    min-width: 0;
    max-width: min(620px, 100%);
    padding: 8px 14px 10px;
    border: 1px solid var(--color-border);
    border-radius: 4px 16px 16px 16px;
    background: rgba(24, 1, 97, 0.55);
    transition: border-color 0.12s;
  }

  &:hover &__body, &--menu &__body { border-color: rgba(var(--color-accent-rgb), 0.35); }

  &--own &__body { background: rgba(79, 23, 135, 0.35); }

  &--team &__body {
    border-color: rgba(var(--color-brand-rgb), 0.5);
    background: rgba(var(--color-brand-rgb), 0.08);
  }

  &__top {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;

    time { font-size: 11px; color: var(--color-text-muted); }
  }

  &__name {
    font-weight: 700;
    font-size: 14px;
    color: var(--color-text);
    text-decoration: none;

    &:is(a):hover { color: var(--color-accent); text-decoration: none; }
  }

  &__reply {
    font-size: 12px;
    color: var(--color-text-muted);
    margin-top: 1px;

    b { color: var(--color-accent); font-weight: 600; }
    &--q { color: #FFD2C0; }
  }

  &__txt {
    margin-top: 2px;
    font-size: 15px;
    line-height: 1.45;
    color: #E9E3FF;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
}

.tag {
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;

  &--team { background: var(--gradient-brand); color: var(--color-on-accent); font-weight: 800; }
  &--day { background: rgba(var(--color-cta-rgb), 0.15); color: var(--color-cta); }
  &--role { background: rgba(var(--color-accent-rgb), 0.14); color: var(--color-accent); }
}

.act {
  position: relative;
  flex-shrink: 0;
  align-self: center;
  display: flex;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.12s;

  > button {
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text-muted);
    font: 600 11px var(--font-sans);
    cursor: pointer;

    &:hover { color: var(--color-text); border-color: var(--color-accent); }
  }

  &__menu {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    z-index: 20;
    min-width: 160px;
    padding: 6px;
    border-radius: 14px;
    background: var(--color-elevated);
    border: 1px solid var(--color-border);
    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45);
    display: flex;
    flex-direction: column;

    button, a {
      padding: 9px 12px;
      border: 0;
      border-radius: 10px;
      background: none;
      color: var(--color-text);
      font: 500 13px var(--font-sans);
      text-align: left;
      text-decoration: none;
      cursor: pointer;

      &:hover { background: rgba(255, 255, 255, 0.07); text-decoration: none; }
    }

    .danger { color: var(--color-danger); }
  }
}

// Touch screens have no hover: keep the actions visible but quiet.
@media (hover: none), (max-width: 700px) {
  .act { opacity: 1; align-self: flex-start; }
  .act > button:first-child { display: none; }
  .act > button { padding: 2px 6px; background: none; border-color: transparent; }
}
</style>
