<script setup lang="ts">
// Password input with a show/hide toggle. With `rules`, it also lists the
// signup password requirements and ticks them off as the user types; the
// same rules are enforced in signup.vue and on the server.
const model = defineModel<string>({ required: true })

const props = withDefaults(defineProps<{
  id: string
  autocomplete?: string
  placeholder?: string
  rules?: boolean
}>(), {
  autocomplete: 'current-password',
  placeholder: '',
  rules: false,
})

const visible = ref(false)

const checks = computed(() => [
  { label: '8+ characters', ok: model.value.length >= 8 },
  { label: 'Uppercase letter', ok: /[A-Z]/.test(model.value) },
  { label: 'Lowercase letter', ok: /[a-z]/.test(model.value) },
  { label: 'Number', ok: /[0-9]/.test(model.value) },
])
</script>

<template>
  <div class="pw">
    <div class="pw__wrap">
      <input
        :id="props.id"
        v-model="model"
        :type="visible ? 'text' : 'password'"
        :autocomplete="props.autocomplete"
        :placeholder="props.placeholder"
        :aria-describedby="props.rules ? `${props.id}-rules` : undefined"
        class="form__input pw__input"
        required
      >
      <button
        type="button"
        class="pw__toggle"
        :aria-label="visible ? 'Hide password' : 'Show password'"
        :aria-pressed="visible"
        @click="visible = !visible"
      >
        <svg v-if="!visible" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18" /><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
      </button>
    </div>
    <ul v-if="props.rules" :id="`${props.id}-rules`" class="pw__rules">
      <li v-for="c in checks" :key="c.label" :class="{ 'pw__rule--ok': c.ok }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path v-if="c.ok" d="M20 6 9 17l-5-5" />
          <circle v-else cx="12" cy="12" r="4" />
        </svg>
        {{ c.label }}
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.pw { display: flex; flex-direction: column; gap: 10px; }
.pw__wrap { position: relative; }
.pw__input { padding-right: 52px !important; }
.pw__toggle {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  svg { width: 20px; height: 20px; }
  &:hover { color: var(--color-text); }
}
.pw__rules {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 12px;
  font-size: 13px;
  color: var(--color-text-muted);

  li { display: flex; align-items: center; gap: 6px; transition: color 0.15s; }
  svg { width: 14px; height: 14px; flex-shrink: 0; }
}
.pw__rules .pw__rule--ok { color: var(--color-accent); }
</style>
