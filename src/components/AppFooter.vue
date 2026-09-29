<template>
  <footer class="ft">
    <div class="ft__inner">
      <div class="ft__brand">
        <NuxtLink to="/" class="ft__logo" aria-label="ChastHub home">
          <BrandLogo :size="20" />
        </NuxtLink>
        <p class="ft__tagline">A chastity timer you don't control.</p>
        <span class="ft__age">18+ only</span>
      </div>

      <nav class="ft__cols" aria-label="Footer">
        <div class="ft__col">
          <span class="ft__head">ChastHub</span>
          <NuxtLink to="/faq" class="ft__link">FAQ</NuxtLink>
          <NuxtLink to="/install" class="ft__link">Get the app</NuxtLink>
          <NuxtLink to="/leaderboard" class="ft__link">Leaderboard</NuxtLink>
        </div>
        <div class="ft__col">
          <span class="ft__head">Help</span>
          <!-- TASK-172: bugs and security issues, one form. -->
          <NuxtLink to="/report" class="ft__link">Report an issue</NuxtLink>
          <a href="mailto:support@chasthub.com" class="ft__link">Contact us</a>
        </div>
        <div class="ft__col">
          <span class="ft__head">Legal</span>
          <NuxtLink to="/terms" class="ft__link">Terms</NuxtLink>
          <NuxtLink to="/privacy" class="ft__link">Privacy</NuxtLink>
        </div>
      </nav>
    </div>

    <div class="ft__bottom">
      <span>© {{ year }} ChastHub</span>
      <span class="ft__note">Consent first. Your release is always yours.</span>
    </div>
  </footer>
</template>

<script setup lang="ts">
// Shown on every page, signed in or out, so it holds what the nav does not:
// install instructions (the only way to get push on iOS), help and legal.
const year = new Date().getFullYear()
</script>

<style scoped lang="scss">
.ft {
  position: relative;
  margin-top: auto;
  border-top: 1px solid var(--color-border);
  background:
    radial-gradient(700px 260px at 10% 0%, rgba(var(--color-brand-rgb), 0.1) 0%, rgba(var(--color-brand-rgb), 0) 70%),
    #0B0029;
  color: var(--color-text);

  // Thin brand line along the top edge
  &::before {
    content: '';
    position: absolute;
    top: -1px;
    left: 0;
    width: 180px;
    height: 2px;
    background: var(--gradient-brand);
  }
}

.ft__inner {
  max-width: 1232px;
  margin: 0 auto;
  padding: 48px 24px 36px;
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 2fr);
  gap: 40px;
}

.ft__brand { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
.ft__logo { text-decoration: none; &:hover { text-decoration: none; opacity: 0.9; } }
.ft__tagline { margin: 0; font-size: 15px; line-height: 1.5; color: #CFC5F2; max-width: 280px; }
.ft__age {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(var(--color-accent-rgb), 0.5);
  color: var(--color-accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.ft__cols {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}
.ft__col { display: flex; flex-direction: column; gap: 10px; }
.ft__head {
  margin-bottom: 4px;
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}
.ft__link {
  align-self: flex-start;
  font-size: 15px;
  color: var(--color-text);
  text-decoration: none;
  transition: color 0.15s;
  &:hover { color: var(--color-accent); text-decoration: none; }
}

.ft__bottom {
  max-width: 1232px;
  margin: 0 auto;
  padding: 18px 24px 28px;
  border-top: 1px solid rgba(52, 19, 138, 0.6);
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  color: var(--color-text-muted);
}

@media (max-width: 760px) {
  .ft__inner { grid-template-columns: minmax(0, 1fr); padding: 40px 20px 28px; gap: 32px; }
  .ft__cols { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px 16px; }
  .ft__bottom { flex-direction: column; padding: 16px 20px 24px; gap: 6px; }
}
</style>
