<script setup lang="ts">
// Split-screen auth shell: a brand panel on the left (desktop only) and the
// form on the right. Pages pick the panel's headline with
// definePageMeta({ authAside: 'login' | 'signup' | 'reset' | 'welcome' }).
const route = useRoute()

const ASIDES = {
  login: { title: 'Your clock kept running.', accent: 'Welcome back.' },
  signup: { title: 'Hand over', accent: 'the key.' },
  reset: { title: 'Locked out?', accent: "There's a spare key." },
  welcome: { title: 'One last thing.', accent: 'Pick your name.' },
} as const

const aside = computed(() => ASIDES[(route.meta.authAside as keyof typeof ASIDES) ?? 'signup'] ?? ASIDES.signup)
</script>

<template>
  <div class="auth-shell">
    <aside class="auth-aside" aria-hidden="true">
      <div class="auth-aside__glow auth-aside__glow--pink" />
      <div class="auth-aside__glow auth-aside__glow--orange" />

      <NuxtLink to="/" class="auth-brand auth-brand--aside" tabindex="-1">Chast<span class="auth-grad">Hub</span></NuxtLink>

      <div class="auth-aside__body">
        <svg class="auth-aside__ring" viewBox="0 0 200 200">
          <defs>
            <linearGradient id="authRing" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#EB3678" />
              <stop offset="1" stop-color="#FB773C" />
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r="86" fill="none" stroke="#4F1787" stroke-width="12" />
          <circle cx="100" cy="100" r="86" fill="none" stroke="url(#authRing)" stroke-width="12" stroke-linecap="round" stroke-dasharray="400 541" transform="rotate(-90 100 100)" />
          <circle cx="100" cy="88" r="17" fill="url(#authRing)" />
          <path d="M91 96h18l5 34H86z" fill="url(#authRing)" />
        </svg>
        <p class="auth-aside__title">{{ aside.title }} <span class="auth-grad">{{ aside.accent }}</span></p>
        <ul class="auth-aside__list">
          <li>30 days free for wearers, no card needed</li>
          <li>Keyholders are always free</li>
          <li>Private by default, strictly 18+</li>
        </ul>
      </div>

      <p class="auth-aside__foot">© {{ new Date().getFullYear() }} ChastHub</p>
    </aside>

    <main class="auth-main">
      <NuxtLink to="/" class="auth-brand auth-brand--mobile">Chast<span class="auth-grad">Hub</span></NuxtLink>
      <div class="auth-card">
        <slot />
      </div>
      <nav class="auth-legal" aria-label="Legal">
        <NuxtLink to="/terms">Terms</NuxtLink>
        <NuxtLink to="/privacy">Privacy</NuxtLink>
        <NuxtLink to="/faq">FAQ</NuxtLink>
      </nav>
    </main>
  </div>
</template>

<style lang="scss">
// Shared by every page that uses this layout (login, signup, reset, OAuth
// callback). Unscoped on purpose, but every rule sits under .auth-shell.
.auth-shell {
  min-height: 100dvh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  background: var(--color-bg);
  color: var(--color-text);

  .auth-grad {
    background: var(--gradient-brand);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .auth-brand {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--color-text);
    text-decoration: none;
    &:hover { color: var(--color-text); text-decoration: none; }
  }

  // ── Brand panel ──────────────────────────────────────────────────────────
  .auth-aside {
    position: relative;
    overflow: hidden;
    padding: 40px 56px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: linear-gradient(160deg, #1B0470 0%, var(--color-bg) 70%);
    border-right: 1px solid var(--color-border);
  }
  .auth-aside__glow {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
    &--pink {
      width: 700px; height: 700px; left: -160px; top: 120px;
      background: radial-gradient(circle, rgba(var(--color-brand-rgb), 0.38) 0%, rgba(var(--color-brand-rgb), 0) 65%);
    }
    &--orange {
      width: 520px; height: 520px; right: -200px; bottom: -120px;
      background: radial-gradient(circle, rgba(var(--color-cta-rgb), 0.28) 0%, rgba(var(--color-cta-rgb), 0) 65%);
    }
  }
  .auth-brand--aside, .auth-aside__body, .auth-aside__foot { position: relative; z-index: 1; }
  .auth-aside__body { display: flex; flex-direction: column; gap: 28px; max-width: 520px; }
  .auth-aside__ring { width: 120px; height: 120px; filter: drop-shadow(0 16px 40px rgba(var(--color-brand-rgb), 0.45)); }
  .auth-aside__title {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(44px, 4.6vw, 72px);
    line-height: 1;
    font-weight: 700;
    letter-spacing: -0.04em;
  }
  .auth-aside__list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-size: 17px;
    color: #CFC5F2;

    li { display: flex; align-items: center; gap: 12px; }
    li::before {
      content: '';
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--gradient-brand);
      flex-shrink: 0;
    }
  }
  .auth-aside__foot { margin: 0; font-size: 13px; color: var(--color-text-muted); }

  // ── Form side ────────────────────────────────────────────────────────────
  .auth-main {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 28px;
    padding: 40px 24px;
  }
  .auth-brand--mobile { display: none; }
  .auth-card { width: 100%; max-width: 420px; }
  .auth-legal {
    display: flex;
    gap: 20px;
    font-size: 13px;
    a { color: var(--color-text-muted); text-decoration: none; }
    a:hover { color: var(--color-text); }
  }

  .auth-title {
    margin: 0 0 8px;
    font-family: var(--font-display);
    font-size: 34px;
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.1;
  }
  .auth-sub {
    margin: 0 0 28px;
    font-size: 16px;
    line-height: 1.55;
    color: var(--color-text-muted);
    strong { color: var(--color-text); }
  }
  .auth-footer {
    margin: 28px 0 0;
    text-align: center;
    font-size: 15px;
    color: var(--color-text-muted);
    a { color: var(--color-accent); font-weight: 600; text-decoration: none; }
    a:hover { text-decoration: underline; }
  }
  .auth-notice {
    margin: 0;
    padding: 14px 16px;
    border-radius: 12px;
    background: rgba(var(--color-accent-rgb), 0.1);
    border: 1px solid rgba(var(--color-accent-rgb), 0.3);
    color: var(--color-text);
    font-size: 15px;
    line-height: 1.5;
  }

  // Steps indicator (signup)
  .auth-steps { display: flex; gap: 8px; margin-bottom: 24px; }
  .auth-steps__bar {
    flex: 1;
    height: 4px;
    border-radius: 999px;
    background: var(--color-elevated);
    &--on { background: var(--gradient-brand); }
  }

  // ── Form controls ────────────────────────────────────────────────────────
  .form { display: flex; flex-direction: column; gap: 18px; }
  .form__field {
    display: flex;
    flex-direction: column;
    gap: 8px;

    label { font-size: 14px; font-weight: 600; color: #CFC5F2; }
  }
  .form__input,
  .form__field > input {
    width: 100%;
    box-sizing: border-box;
    height: 52px;
    padding: 0 16px;
    background: var(--color-surface);
    border: 1.5px solid var(--color-border);
    border-radius: 14px;
    font-size: 16px;
    font-family: var(--font-sans);
    color: var(--color-text);
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;

    &::placeholder { color: rgba(169, 156, 214, 0.6); }
    &:focus {
      border-color: var(--color-accent);
      box-shadow: 0 0 0 4px rgba(var(--color-accent-rgb), 0.18);
    }
  }
  .form__row { display: flex; justify-content: space-between; align-items: center; }
  .form__forgot {
    font-size: 14px;
    color: var(--color-text-muted);
    text-decoration: none;
    &:hover { color: var(--color-accent); }
  }
  .form__error {
    margin: 0;
    padding: 12px 14px;
    border-radius: 12px;
    background: rgba(var(--color-danger-rgb), 0.1);
    border: 1px solid rgba(var(--color-danger-rgb), 0.35);
    color: var(--color-danger);
    font-size: 14px;
    line-height: 1.45;
  }
  .form__hint { margin: 0; font-size: 14px; color: var(--color-text-muted); }

  // ── Buttons ──────────────────────────────────────────────────────────────
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    height: 54px;
    padding: 0 24px;
    border-radius: 999px;
    border: 0;
    font-family: var(--font-sans);
    font-size: 16px;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s, background 0.15s, border-color 0.15s;
    &:disabled { opacity: 0.5; cursor: not-allowed; }
    &:hover { text-decoration: none; }
  }
  .btn--full, .form .btn--primary { width: 100%; }
  .btn--primary {
    background: var(--color-cta);
    color: var(--color-on-accent);
    box-shadow: 0 10px 32px rgba(var(--color-cta-rgb), 0.35);
    &:hover:not(:disabled) { transform: translateY(-1px); color: var(--color-on-accent); box-shadow: 0 12px 40px rgba(var(--color-cta-rgb), 0.5); }
  }
  .btn--ghost {
    background: transparent;
    color: var(--color-text);
    border: 1.5px solid rgba(244, 240, 255, 0.3);
    font-weight: 600;
    &:hover:not(:disabled) { border-color: rgba(244, 240, 255, 0.6); color: var(--color-text); }
  }
  .btn--google {
    width: 100%;
    background: var(--color-surface);
    color: var(--color-text);
    border: 1.5px solid var(--color-border);
    font-weight: 600;
    &:hover:not(:disabled) { border-color: var(--color-elevated); background: #1F0677; }
  }
  .btn--x {
    width: 100%;
    margin-top: 10px;
    background: #000;
    color: #fff;
    border: 1.5px solid #2f2f2f;
    font-weight: 600;
    &:hover:not(:disabled) { background: #111; border-color: #555; color: #fff; }
  }
  .oauth-note { margin: 10px 0 0; text-align: center; font-size: 12px; color: var(--color-text-muted); }
  .btn__icon { width: 20px; height: 20px; flex-shrink: 0; }

  .divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 22px 0;
    color: var(--color-text-muted);
    font-size: 13px;
    &::before, &::after { content: ''; flex: 1; height: 1px; background: var(--color-border); }
  }

  .auth-actions { display: flex; gap: 12px; margin-top: 24px; .btn { flex: 1; } }

  // ── Consent checkbox ─────────────────────────────────────────────────────
  .consent {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-top: 20px;
    font-size: 14px;
    line-height: 1.5;
    color: #CFC5F2;
    cursor: pointer;

    input {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      margin: 1px 0 0;
      accent-color: var(--color-accent);
      cursor: pointer;
    }
    a { color: var(--color-accent); }
  }
}

@media (max-width: 960px) {
  .auth-shell {
    grid-template-columns: minmax(0, 1fr);

    .auth-aside { display: none; }
    .auth-main {
      justify-content: flex-start;
      padding: 28px 20px 32px;
      background:
        radial-gradient(circle at 50% -10%, rgba(var(--color-brand-rgb), 0.3) 0%, rgba(var(--color-brand-rgb), 0) 55%),
        var(--color-bg);
    }
    .auth-brand--mobile { display: block; align-self: flex-start; font-size: 22px; }
    .auth-card { margin-top: 12px; }
    .auth-title { font-size: 30px; }
  }
}
</style>
