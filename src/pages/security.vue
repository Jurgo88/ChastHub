<template>
  <div class="dash">
    <AppNav />

    <div class="dash-body">
      <div class="dash-header">
        <div class="dash-header__text">
          <h1 class="dash-header__title">Report an issue</h1>
          <p class="dash-header__sub">
            Something broken, or something that looks unsafe? Tell us here — we
            read every report. Found a vulnerability? Please give us time to
            fix it before disclosing it publicly.
          </p>
        </div>
      </div>

      <form v-if="!sent" class="sec-form" @submit.prevent="submit">
        <!-- TASK-172 — the kind keeps security reports from getting lost
             among bug reports in the admin inbox. -->
        <fieldset class="sec-form__kinds">
          <legend class="sec-form__label">What kind of issue is it?</legend>
          <label v-for="k in KINDS" :key="k.value" class="sec-form__kind" :class="{ 'sec-form__kind--on': kind === k.value }">
            <input v-model="kind" type="radio" name="kind" :value="k.value">
            <span class="sec-form__kind-title">{{ k.label }}</span>
            <span class="sec-form__kind-hint">{{ k.hint }}</span>
          </label>
        </fieldset>

        <label class="sec-form__label" for="sec-msg">What did you find?</label>
        <textarea
          id="sec-msg" v-model="message" class="sec-form__textarea" rows="8" required
          :placeholder="kind === 'security'
            ? 'Describe the issue, steps to reproduce, and the affected URL or endpoint.'
            : 'What happened, what you expected, and where in the app (page or screen).'"
        />

        <label class="sec-form__label" for="sec-contact">How can we reach you? (optional)</label>
        <input
          id="sec-contact" v-model="contact" class="sec-form__input" type="text"
          autocomplete="off" placeholder="Email or handle — or leave blank to stay anonymous"
        >

        <!-- honeypot: skryté pred používateľmi, chytá botov -->
        <input
          v-model="website" class="sec-form__hp" type="text" tabindex="-1"
          autocomplete="off" aria-hidden="true"
        >

        <p v-if="error" class="sec-form__error">{{ error }}</p>

        <button class="sec-form__submit" type="submit" :disabled="busy">
          {{ busy ? 'Sending…' : 'Send report' }}
        </button>
      </form>

      <div v-else class="sec-done">
        <p>Thank you — your report has been received. If you left contact details, we may follow up.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// TASK-172 — one form for any issue. /report is the page's own URL; /security
// is kept because /.well-known/security.txt points researchers there, and it
// arrives with "Security" already chosen.
definePageMeta({ alias: ['/report'] })

type Kind = 'bug' | 'security' | 'other'
const KINDS: { value: Kind; label: string; hint: string }[] = [
  { value: 'bug', label: "Something doesn't work", hint: 'A bug, an error, something broken' },
  { value: 'security', label: 'Security problem', hint: "A vulnerability, or data others shouldn't see" },
  { value: 'other', label: 'Something else', hint: "Anything that isn't one of the above" },
]

const route = useRoute()
const kind = ref<Kind | null>(route.path.startsWith('/security') ? 'security' : null)
const message = ref('')
const contact = ref('')
const website = ref('') // honeypot
const busy = ref(false)
const sent = ref(false)
const error = ref('')

const { public: { siteUrl } } = useRuntimeConfig()
useHead({
  title: 'Report an issue — ChastHub',
  // Two URLs, one page: tell search engines which one is the page.
  link: [{ rel: 'canonical', href: `${siteUrl}/report` }],
})

async function submit() {
  error.value = ''
  if (!kind.value) {
    error.value = 'Please choose what kind of issue this is.'
    return
  }
  if (message.value.trim().length < 10) {
    error.value = 'Please describe the issue (at least 10 characters).'
    return
  }
  busy.value = true
  try {
    await $fetch('/api/security/report', {
      method: 'POST',
      body: { kind: kind.value, message: message.value, contact: contact.value, website: website.value },
    })
    sent.value = true
  }
  catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    error.value = err?.data?.message || 'Could not submit. Please try again.'
  }
  finally {
    busy.value = false
  }
}
</script>

<style scoped lang="scss">
// The page layout (.dash, .dash-body, .dash-header) — without it the page
// ran edge to edge. It matters now the footer links here (TASK-172).
@use '~/assets/styles/loq-card' as *;

.sec-form {
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.sec-form__label {
  font-weight: 600;
  margin-top: 0.75rem;
}

.sec-form__textarea,
.sec-form__input {
  width: 100%;
  padding: 0.6rem 0.7rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  font: inherit;
}

.sec-form__textarea { resize: vertical; }

.sec-form__kinds {
  border: 0;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
  gap: 0.5rem;

  legend { padding: 0; margin-bottom: 0.4rem; }
}

.sec-form__kind {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  cursor: pointer;

  input { position: absolute; opacity: 0; pointer-events: none; }

  &--on {
    border-color: var(--color-accent);
    background: rgba(var(--color-accent-rgb), 0.12);
  }

  &:focus-within { outline: 2px solid var(--color-accent); outline-offset: 2px; }
}

.sec-form__kind-title { font-weight: 600; }
.sec-form__kind-hint { font-size: 0.85rem; opacity: 0.7; }

// honeypot — mimo obrazovky, používateľ ho nevidí, bot ho vyplní
.sec-form__hp {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.sec-form__error {
  color: #ff6b6b;
  margin-top: 0.5rem;
}

.sec-form__submit {
  margin-top: 1rem;
  align-self: flex-start;
  padding: 0.6rem 1.3rem;
  border: 0;
  border-radius: 8px;
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-weight: 600;
  cursor: pointer;
}

.sec-form__submit:disabled {
  opacity: 0.6;
  cursor: default;
}

.sec-done { max-width: 640px; }
</style>
