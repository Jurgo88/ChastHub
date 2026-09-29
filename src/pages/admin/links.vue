<template>
  <div class="admin-section">
    <div class="admin-section-header">
      <h1>Links</h1>
      <span class="text-muted">Tagged links, so signups from them show up in “How they found us”</span>
    </div>

    <form class="builder" @submit.prevent="copy">
      <label class="field">
        <span class="field__label">Landing page</span>
        <select v-model="path" class="admin-input">
          <option v-for="p in LANDING_PAGES" :key="p.path" :value="p.path">{{ p.label }} ({{ p.path }})</option>
        </select>
      </label>

      <div class="field">
        <span class="field__label">Source <em>where the link is posted</em></span>
        <div class="chips">
          <button
            v-for="s in SOURCE_PRESETS"
            :key="s"
            type="button"
            class="filter-tab"
            :class="{ 'filter-tab--active': normaliseUtm(source) === s }"
            @click="source = s"
          >
            {{ s }}
          </button>
        </div>
        <input v-model="source" class="admin-input" placeholder="or type one, e.g. fapchat" maxlength="100">
      </div>

      <div class="field">
        <span class="field__label">Medium <em>what kind of link</em></span>
        <div class="chips">
          <button
            v-for="m in MEDIUM_PRESETS"
            :key="m"
            type="button"
            class="filter-tab"
            :class="{ 'filter-tab--active': normaliseUtm(medium) === m }"
            @click="medium = m"
          >
            {{ m }}
          </button>
        </div>
        <input v-model="medium" class="admin-input" placeholder="or type one" maxlength="100">
      </div>

      <label class="field">
        <span class="field__label">Campaign <em>which post or push</em></span>
        <input v-model="campaign" class="admin-input" placeholder="e.g. autumn-launch, profile-bio" maxlength="100">
      </label>

      <label class="field">
        <span class="field__label">Content <em>optional — tells two links in one campaign apart; seen in Google Analytics only</em></span>
        <input v-model="content" class="admin-input" placeholder="e.g. banner-a" maxlength="100">
      </label>

      <div class="result" :class="{ 'result--empty': !url }">
        <template v-if="url">
          <code class="result__url">{{ url }}</code>
          <button type="submit" class="btn btn-primary btn-sm">{{ copied ? '✓ Copied' : 'Copy' }}</button>
        </template>
        <span v-else class="text-muted">Pick a source, a medium and a campaign to get the link.</span>
      </div>
    </form>

    <section class="guide">
      <h2>Naming, so the numbers add up</h2>
      <ul>
        <li><strong>Source</strong> is the place: <code>x</code>, <code>reddit</code>, <code>instagram</code>. Always the same word for the same place — <code>x</code>, never <code>twitter</code> one day and <code>x</code> the next.</li>
        <li><strong>Medium</strong> is the kind of link: <code>bio</code> for a profile link, <code>post</code> for a post, <code>dm</code>, <code>ad</code>, <code>qr</code> for printed codes.</li>
        <li><strong>Campaign</strong> is the push: one name per announcement, promo or partner.</li>
        <li>Everything is lower-cased and spaces become <code>-</code> automatically.</li>
        <li>Signups from a link appear in Dashboard → Product → How they found us → Campaign links.</li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
// TASK-184 — build UTM-tagged links. Reads and writes nothing; any admin may
// use it.
import { LANDING_PAGES, MEDIUM_PRESETS, SOURCE_PRESETS, buildTrackedUrl, normaliseUtm } from '~/utils/trackedLink'

definePageMeta({ layout: 'admin', middleware: 'admin', adminLevel: ['analyst', 'support', 'super_admin'] })

const { public: { siteUrl } } = useRuntimeConfig()

const path = ref<string>(LANDING_PAGES[0].path)
const source = ref('')
const medium = ref('')
const campaign = ref('')
const content = ref('')
const copied = ref(false)

const url = computed(() => buildTrackedUrl(siteUrl as string, {
  path: path.value,
  source: source.value,
  medium: medium.value,
  campaign: campaign.value,
  content: content.value,
}))

// A copied link that no longer matches the form would be the wrong one.
watch(url, () => { copied.value = false })

async function copy() {
  if (!url.value) return
  try {
    await navigator.clipboard.writeText(url.value)
    copied.value = true
  }
  catch { /* the URL is on screen to copy by hand */ }
}
</script>

<style lang="scss" scoped>
@use './admin-shared';

.builder {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 720px;
  padding: 1.25rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  &__label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text);

    em {
      font-style: normal;
      font-weight: 400;
      color: var(--color-text-muted);
      margin-left: 0.35rem;
    }
  }
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.result {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  background: var(--color-bg);
  border: 1px solid var(--color-accent);

  &--empty { border-color: var(--color-border); }

  &__url {
    flex: 1;
    min-width: 0;
    font-size: 0.85rem;
    color: var(--color-text);
    overflow-wrap: anywhere;
  }
}

.guide {
  max-width: 720px;
  font-size: 0.875rem;
  color: var(--color-text-muted);

  h2 {
    font-size: 0.95rem;
    color: var(--color-text);
    margin: 0 0 0.5rem;
  }

  ul { margin: 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.35rem; }

  code {
    font-size: 0.8rem;
    padding: 0.05rem 0.3rem;
    border-radius: 0.25rem;
    background: var(--color-border);
    color: var(--color-text);
  }
}
</style>
