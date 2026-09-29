<template>
  <ClientOnly>
    <header class="app-nav">
      <NuxtLink :to="brandLink" class="app-nav__brand" aria-label="ChastHub home">
        <BrandLogo :size="21" />
      </NuxtLink>

      <!-- Desktop links -->
      <nav class="app-nav__links app-nav__links--desktop">
        <template v-if="authStore.isAuthenticated">
          <NuxtLink :to="dashboardLink" class="app-nav__link" active-class="app-nav__link--active">Dashboard</NuxtLink>
          <NuxtLink to="/keydrop" class="app-nav__link" active-class="app-nav__link--active">Key Drop</NuxtLink>
          <NuxtLink to="/stats" class="app-nav__link" active-class="app-nav__link--active">Stats</NuxtLink>
          <NuxtLink to="/shop" class="app-nav__link" active-class="app-nav__link--active">Shop</NuxtLink>
          <NuxtLink to="/messages" class="app-nav__link" active-class="app-nav__link--active">Messages</NuxtLink>
          <NuxtLink v-if="authStore.isLoqee && !authStore.hasAccess" to="/subscription/upgrade" class="app-nav__link app-nav__link--cta">Upgrade</NuxtLink>
          <NuxtLink v-if="authStore.isAdmin" to="/admin" class="app-nav__link" active-class="app-nav__link--active">Admin</NuxtLink>
          <span class="app-nav__sep" />

          <!-- TASK-122 — Profile and Log out moved off the top bar and behind
               the avatar, which until now was decoration only. -->
          <div ref="menuRoot" class="app-nav__menu">
            <button
              class="app-nav__avatar-btn"
              :aria-expanded="accountMenuOpen"
              aria-haspopup="menu"
              aria-label="Account menu"
              @click="accountMenuOpen = !accountMenuOpen"
            >
              <UserAvatar class="app-nav__avatar" :avatar-url="authStore.profile?.avatar_url" :display-name="displayName" />
            </button>

            <Transition name="menu">
              <div v-if="accountMenuOpen" class="app-nav__menu-panel" role="menu">
                <span class="app-nav__menu-name">{{ displayName }}</span>
                <NuxtLink to="/profile" class="app-nav__menu-item" role="menuitem" @click="accountMenuOpen = false">Profile</NuxtLink>
                <button class="app-nav__menu-item app-nav__menu-item--logout" role="menuitem" @click="logout">Log out</button>
              </div>
            </Transition>
          </div>
        </template>
        <template v-else>
          <NuxtLink to="/faq" class="app-nav__link" active-class="app-nav__link--active">FAQ</NuxtLink>
          <NuxtLink to="/auth/login" class="app-nav__link">Log in</NuxtLink>
          <NuxtLink to="/auth/signup" class="app-nav__link app-nav__link--cta">Sign up free</NuxtLink>
        </template>
      </nav>

      <!-- Mobile hamburger -->
      <button class="app-nav__burger" :aria-expanded="menuOpen" aria-label="Toggle menu" @click="menuOpen = !menuOpen">
        <span /><span /><span />
      </button>

      <!-- Mobile drawer -->
      <Transition name="drawer">
        <nav v-if="menuOpen" class="app-nav__drawer" @click="menuOpen = false">
          <template v-if="authStore.isAuthenticated">
            <div class="app-nav__drawer-identity">
              <UserAvatar class="app-nav__avatar" :avatar-url="authStore.profile?.avatar_url" :display-name="displayName" />
              <span class="app-nav__drawer-name">{{ displayName }}</span>
            </div>
            <NuxtLink :to="dashboardLink" class="app-nav__drawer-link">Dashboard</NuxtLink>
            <NuxtLink to="/keydrop" class="app-nav__drawer-link">Key Drop</NuxtLink>
            <NuxtLink to="/stats" class="app-nav__drawer-link">Stats</NuxtLink>
            <NuxtLink to="/shop" class="app-nav__drawer-link">Shop</NuxtLink>
            <NuxtLink to="/messages" class="app-nav__drawer-link">Messages</NuxtLink>
            <NuxtLink to="/profile" class="app-nav__drawer-link">Profile</NuxtLink>
            <NuxtLink v-if="authStore.isLoqee && !authStore.hasAccess" to="/subscription/upgrade" class="app-nav__drawer-link app-nav__drawer-link--cta">Upgrade to Premium</NuxtLink>
            <NuxtLink v-if="authStore.isAdmin" to="/admin" class="app-nav__drawer-link">Admin</NuxtLink>
            <button class="app-nav__drawer-link app-nav__drawer-link--logout" @click="logout">Log out</button>
          </template>
          <template v-else>
            <NuxtLink to="/faq" class="app-nav__drawer-link">FAQ</NuxtLink>
            <NuxtLink to="/auth/login" class="app-nav__drawer-link">Log in</NuxtLink>
            <NuxtLink to="/auth/signup" class="app-nav__drawer-link app-nav__drawer-link--cta">Sign up free</NuxtLink>
          </template>
        </nav>
      </Transition>
    </header>

      <!-- TASK-110 — these pages are server-rendered, and the auth plugin
           (client-only, async) has not restored the session at that point.
           Rendering the logged-out nav server-side would flash "Log in" at
           an already-authenticated user during hydration, so reserve the
           header height instead and let the client paint the real nav. -->
      <template #fallback>
        <div class="app-nav" />
      </template>
  </ClientOnly>
</template>

<script setup lang="ts">
const authStore = useAuthStore()
const { logout: authLogout } = useAuth()
const route = useRoute()

// TASK-122 — "Get the app" is no longer a nav entry at all (it lives on the
// profile page, TASK-105), so the TASK-106 isInstalled check that used to
// hide it once installed went with it.
const menuOpen = ref(false)          // mobile drawer
const accountMenuOpen = ref(false)   // desktop avatar dropdown
const menuRoot = ref<HTMLElement | null>(null)

// Close the dropdown on outside click, Escape, and navigation — a panel that
// survives a route change ends up floating over the page you just opened.
function onDocumentClick(e: MouseEvent) {
  if (!accountMenuOpen.value) return
  if (menuRoot.value?.contains(e.target as Node)) return
  accountMenuOpen.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') accountMenuOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})

watch(() => route.fullPath, () => { accountMenuOpen.value = false })

const dashboardLink = computed(() =>
  authStore.isLoqholder ? '/dashboard/keyholder' : '/dashboard/wearer'
)

const brandLink = computed(() =>
  authStore.isAuthenticated ? dashboardLink.value : '/'
)

// TASK-124 — never fall back to the email address: it is the user's real
// identity and this string is rendered next to their avatar.
const displayName = computed(() =>
  authStore.profile?.display_name ?? 'ChastHub user'
)

async function logout() {
  menuOpen.value = false
  accountMenuOpen.value = false
  // TASK-082 — routes through the shared composable (which hits
  // /api/auth/logout first) instead of duplicating sign-out logic here, so
  // the httpOnly recovery cookie actually gets cleared on this — the most
  // common — logout path.
  await authLogout()
}
</script>

<style scoped lang="scss">
.app-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 16px;
  height: 64px;
  padding: 0 24px;
  border-bottom: 1px solid var(--color-border);
  background: rgba(14, 0, 51, 0.82);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  flex-shrink: 0;

  &__brand {
    display: flex;
    align-items: center;
    text-decoration: none;
    flex-shrink: 0;
    &:hover { text-decoration: none; opacity: 0.9; }
  }

  &__links--desktop {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;

    @media (max-width: 760px) { display: none; }
  }

  &__link {
    position: relative;
    font-size: 15px;
    font-weight: 500;
    color: #CFC5F2;
    text-decoration: none;
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px 12px;
    border-radius: 999px;
    transition: background 0.15s, color 0.15s;

    &:hover {
      color: var(--color-text);
      background: rgba(244, 240, 255, 0.06);
      text-decoration: none;
    }

    &--active {
      color: var(--color-text);
      background: rgba(var(--color-accent-rgb), 0.14);
      font-weight: 600;

      &::after {
        content: '';
        position: absolute;
        left: 50%;
        bottom: -13px;
        width: 22px;
        height: 3px;
        border-radius: 3px;
        background: var(--gradient-brand);
        transform: translateX(-50%);
      }
    }

    &--cta {
      margin-left: 6px;
      padding: 9px 18px;
      background: var(--color-cta);
      color: var(--color-on-accent);
      font-weight: 700;

      &:hover { background: var(--color-cta); color: var(--color-on-accent); filter: brightness(1.06); }
    }
  }

  &__sep {
    width: 1px;
    height: 22px;
    background: var(--color-border);
    margin: 0 8px;
  }

  &__avatar {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &__menu { position: relative; display: flex; align-items: center; }

  &__avatar-btn {
    display: flex;
    align-items: center;
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px;
    border-radius: 50%;
    box-shadow: 0 0 0 2px var(--color-elevated);
    transition: box-shadow 0.15s;

    &:hover,
    &[aria-expanded="true"] { box-shadow: 0 0 0 2px var(--color-accent); }
  }

  &__menu-panel {
    position: absolute;
    top: calc(100% + 12px);
    right: 0;
    min-width: 200px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 16px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
    z-index: 110;
  }

  &__menu-name {
    font-size: 13px;
    color: var(--color-text-muted);
    padding: 6px 10px 10px;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__menu-item {
    display: block;
    width: 100%;
    text-align: left;
    font-size: 15px;
    font-family: var(--font-sans);
    color: var(--color-text);
    text-decoration: none;
    background: none;
    border: none;
    cursor: pointer;
    padding: 10px;
    border-radius: 10px;
    transition: background 0.15s;

    &:hover { background: rgba(244, 240, 255, 0.06); color: var(--color-text); text-decoration: none; }
    &--logout { color: var(--color-text-muted); }
  }

  &__burger {
    display: none;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 5px;
    width: 44px;
    height: 44px;
    background: none;
    border: none;
    cursor: pointer;
    margin-left: auto;
    border-radius: 12px;

    span {
      display: block;
      width: 20px;
      height: 2px;
      background: var(--color-text);
      border-radius: 1px;
      transition: transform 0.2s, opacity 0.2s;
    }

    &[aria-expanded="true"] span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
    &[aria-expanded="true"] span:nth-child(2) { opacity: 0; }
    &[aria-expanded="true"] span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

    @media (max-width: 760px) { display: flex; }
  }

  &__drawer {
    position: fixed;
    top: 64px;
    left: 0;
    right: 0;
    max-height: calc(100dvh - 64px);
    overflow-y: auto;
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
    padding: 12px 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    z-index: 99;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  }

  &__drawer-identity {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px 14px;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 6px;
  }

  &__drawer-name { font-size: 15px; font-weight: 600; color: var(--color-text); }

  &__drawer-link {
    display: block;
    font-size: 17px;
    font-family: var(--font-sans);
    font-weight: 500;
    color: var(--color-text);
    text-decoration: none;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    width: 100%;
    padding: 13px 12px;
    border-radius: 12px;
    transition: background 0.15s;

    &:hover { background: rgba(244, 240, 255, 0.06); color: var(--color-text); text-decoration: none; }

    &.router-link-active {
      background: rgba(var(--color-accent-rgb), 0.14);
      font-weight: 600;
    }

    &--cta {
      margin-top: 8px;
      text-align: center;
      background: var(--color-cta);
      color: var(--color-on-accent);
      font-weight: 700;
      border-radius: 999px;
      &:hover { background: var(--color-cta); color: var(--color-on-accent); }
    }

    &--logout { color: var(--color-text-muted); margin-top: 6px; }
  }
}

.menu-enter-active,
.menu-leave-active { transition: opacity 0.12s, transform 0.12s; }
.menu-enter-from,
.menu-leave-to { opacity: 0; transform: translateY(-4px); }

.drawer-enter-active,
.drawer-leave-active { transition: opacity 0.15s, transform 0.15s; }
.drawer-enter-from,
.drawer-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
