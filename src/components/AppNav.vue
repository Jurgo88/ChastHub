<template>
  <ClientOnly>
    <header class="app-nav">
      <NuxtLink :to="brandLink" class="app-nav__brand">
        <img :src="logoSrc" width="560" height="312" alt="ChastHub" class="app-nav__logo" />
      </NuxtLink>

      <!-- Desktop links -->
      <nav class="app-nav__links app-nav__links--desktop">
        <template v-if="authStore.isAuthenticated">
          <NuxtLink :to="dashboardLink" class="app-nav__link" active-class="app-nav__link--active">Dashboard</NuxtLink>
          <NuxtLink to="/discover" class="app-nav__link" active-class="app-nav__link--active">Discover</NuxtLink>
          <NuxtLink to="/leaderboard" class="app-nav__link" active-class="app-nav__link--active">Leaderboard</NuxtLink>
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
          <NuxtLink to="/auth/login" class="app-nav__link">Log in</NuxtLink>
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
            <NuxtLink to="/discover" class="app-nav__drawer-link">Discover</NuxtLink>
            <NuxtLink to="/leaderboard" class="app-nav__drawer-link">Leaderboard</NuxtLink>
            <NuxtLink to="/shop" class="app-nav__drawer-link">Shop</NuxtLink>
            <NuxtLink to="/messages" class="app-nav__drawer-link">Messages</NuxtLink>
            <NuxtLink to="/profile" class="app-nav__drawer-link">Profile</NuxtLink>
            <NuxtLink v-if="authStore.isLoqee && !authStore.hasAccess" to="/subscription/upgrade" class="app-nav__drawer-link app-nav__drawer-link--cta">Upgrade to Premium</NuxtLink>
            <NuxtLink v-if="authStore.isAdmin" to="/admin" class="app-nav__drawer-link">Admin</NuxtLink>
            <button class="app-nav__drawer-link app-nav__drawer-link--logout" @click="logout">Log out</button>
          </template>
          <template v-else>
            <NuxtLink to="/auth/login" class="app-nav__drawer-link">Log in</NuxtLink>
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
import logoSrc from '~/assets/images/logos/chasthub-font-nobg.webp'

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
  authStore.isLoqholder ? '/dashboard/loqholder' : '/dashboard/loqee'
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
  height: 3.25rem;
  padding: 0 1.5rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
  flex-shrink: 0;

  &__brand {
    display: flex;
    align-items: center;
    text-decoration: none;
    flex-shrink: 0;

    &:hover { opacity: 0.8; }
  }

  &__logo {
    height: 2.75rem;
    width: auto;
    display: block;
  }

  &__links--desktop {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-left: auto;

    @media (max-width: 640px) { display: none; }
  }

  &__link {
    font-size: 0.875rem;
    color: var(--color-text);
    text-decoration: none;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.375rem 0.5rem;
    border-radius: 0.375rem;
    transition: background 0.12s, color 0.12s;

    &:hover {
      background: rgba(255, 255, 255, 0.08);
      color: var(--color-accent);
      text-decoration: none;
    }

    &--active {
      color: var(--color-accent);
      background: rgba(var(--color-accent-rgb), 0.12);
      font-weight: 600;
    }

    &--cta {
      background: var(--color-accent);
      color: var(--color-on-accent);
      font-weight: 600;
      padding: 0.35rem 0.75rem;
      border-radius: 999px;

      &:hover {
        background: var(--color-accent);
        opacity: 0.85;
        color: var(--color-on-accent);
      }
    }
  }

  &__sep {
    width: 1px;
    height: 1.125rem;
    background: var(--color-border);
    margin: 0 0.25rem;
  }

  &__avatar {
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &__drawer-identity {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 0.375rem;
  }

  // TASK-122 — avatar dropdown
  &__menu {
    position: relative;
    display: flex;
    align-items: center;
  }

  &__avatar-btn {
    display: flex;
    align-items: center;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.125rem;
    border-radius: 50%;
    transition: box-shadow 0.12s;

    &:hover,
    &[aria-expanded="true"] {
      box-shadow: 0 0 0 2px rgba(var(--color-accent-rgb), 0.45);
    }
  }

  &__menu-panel {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    min-width: 11rem;
    padding: 0.375rem;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    z-index: 110;
  }

  &__menu-name {
    font-size: 0.75rem;
    color: var(--color-muted);
    padding: 0.25rem 0.5rem 0.375rem;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 0.125rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__menu-item {
    display: block;
    width: 100%;
    text-align: left;
    font-size: 0.875rem;
    color: var(--color-text);
    text-decoration: none;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.375rem;
    transition: background 0.12s, color 0.12s;

    &:hover {
      background: rgba(255, 255, 255, 0.08);
      color: var(--color-accent);
      text-decoration: none;
    }

    &--logout { color: var(--color-muted); }
  }

  &__burger {
    display: none;
    flex-direction: column;
    justify-content: center;
    gap: 5px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    margin-left: auto;
    border-radius: 0.375rem;

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

    @media (max-width: 640px) { display: flex; }
  }

  &__drawer {
    position: fixed;
    top: 3.25rem;
    left: 0;
    right: 0;
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
    padding: 0.75rem 1.5rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    z-index: 99;
    box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  }

  &__drawer-name {
    font-size: 0.8125rem;
    color: var(--color-muted);
  }

  &__drawer-link {
    display: block;
    font-size: 0.9375rem;
    color: var(--color-text);
    text-decoration: none;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    width: 100%;
    padding: 0.625rem 0.5rem;
    border-radius: 0.375rem;
    transition: background 0.12s;

    &:hover { background: rgba(255, 255, 255, 0.06); color: var(--color-accent); text-decoration: none; }

    &.router-link-active {
      color: var(--color-accent);
      background: rgba(var(--color-accent-rgb), 0.12);
      font-weight: 600;
    }

    &--cta {
      color: var(--color-accent);
      font-weight: 600;
    }

    &--logout { color: var(--color-muted); margin-top: 0.25rem; }
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
