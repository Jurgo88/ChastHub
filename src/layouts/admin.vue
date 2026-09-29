<template>
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <div class="admin-brand">Admin</div>
      <NuxtLink to="/dashboard" class="admin-back-btn">
        <svg class="admin-back-btn__icon" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>Back to app</span>
      </NuxtLink>
      <nav class="admin-nav">
        <!--
          /admin is a prefix of every route below it, so the default
          router-link-active would mark this link selected on every admin
          page. active-class points the prefix match at a class with no
          styles and exact-active-class carries the real one, so Dashboard
          highlights only when it is the page you are on.

          Outside the canModerate guard on purpose: an analyst can open the
          dashboard but none of the other pages, and until now that left them
          with an empty sidebar.
        -->
        <NuxtLink
          to="/admin"
          class="admin-nav-link"
          active-class="is-ancestor"
          exact-active-class="router-link-active"
        >
          Dashboard
        </NuxtLink>
        <!-- TASK-185 / TASK-184 — every admin level, like the dashboard. -->
        <NuxtLink to="/admin/insights" class="admin-nav-link">Insights</NuxtLink>
        <NuxtLink to="/admin/links" class="admin-nav-link">Links</NuxtLink>
        <template v-if="canModerate">
          <NuxtLink to="/admin/users" class="admin-nav-link">Users</NuxtLink>
          <NuxtLink to="/admin/locks" class="admin-nav-link">Locks</NuxtLink>
          <NuxtLink to="/admin/messages" class="admin-nav-link">Messages</NuxtLink>
          <NuxtLink to="/admin/reports" class="admin-nav-link">Reports</NuxtLink>
        </template>
        <template v-if="authStore.isSuperAdmin">
          <NuxtLink to="/admin/deletions" class="admin-nav-link">Deletions</NuxtLink>
          <NuxtLink to="/admin/admins" class="admin-nav-link">Admins</NuxtLink>
          <NuxtLink to="/admin/issues" class="admin-nav-link">Issues</NuxtLink>
          <NuxtLink to="/admin/audit" class="admin-nav-link">Audit log</NuxtLink>
        </template>
      </nav>
    </aside>
    <main class="admin-main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const authStore = useAuthStore()
const canModerate = computed(() => authStore.isSupport || authStore.isSuperAdmin)
</script>

<style lang="scss" scoped>
.admin-shell {
  display: flex;
  min-height: 100vh;
  background: var(--color-bg);
}

.admin-sidebar {
  width: 200px;
  flex-shrink: 0;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  padding: 1.5rem 1rem;
  gap: 0.5rem;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

.admin-brand {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-accent);
  padding: 0 0.5rem 1rem;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 0.5rem;
}

.admin-nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.admin-nav-link {
  display: block;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  color: var(--color-muted);
  text-decoration: none;
  font-size: 0.9rem;
  transition: background 0.1s, color 0.1s;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-text);
  }

  &.router-link-active {
    background: rgba(var(--color-accent-rgb), 0.15);
    color: var(--color-accent);
    font-weight: 600;
  }
}

.admin-back-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.5rem;
  margin: 0 -0.5rem 0.75rem;
  color: var(--color-muted);
  text-decoration: none;
  font-size: 0.8125rem;
  font-weight: 500;
  border-radius: 0.375rem;
  transition: background 0.12s, color 0.12s;

  &__icon {
    flex-shrink: 0;
    transition: transform 0.12s;
  }

  &:hover {
    color: var(--color-text);
    background: rgba(255, 255, 255, 0.06);

    .admin-back-btn__icon {
      transform: translateX(-2px);
    }
  }
}

.admin-main {
  flex: 1;
  // Without this a flex item is at least as wide as its content, so one wide
  // table pushed the whole page past the screen. Now it scrolls in here.
  min-width: 0;
  padding: 2rem;
  overflow-y: auto;
}

// TASK-163 — on a phone the 200px sidebar left ~150px for the page. It turns
// into a top bar: brand and "Back to app" on one line, the sections as a
// strip that scrolls sideways.
@media (max-width: 768px) {
  .admin-shell {
    flex-direction: column;
  }

  .admin-sidebar {
    width: auto;
    height: auto;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
    padding: 0.75rem 1rem 0.5rem;
    border-right: none;
    border-bottom: 1px solid var(--color-border);
    overflow: visible;
    z-index: 10;
  }

  .admin-brand {
    padding: 0;
    margin: 0;
    border-bottom: none;
  }

  .admin-back-btn {
    order: 1;
    margin: 0 0 0 auto;
  }

  .admin-nav {
    order: 2;
    flex: 1 0 100%;
    flex-direction: row;
    overflow-x: auto;
    scrollbar-width: none;
    margin: 0 -1rem;
    padding: 0 1rem;
    // The scrollbar is hidden, so fade the right edge to show there is more.
    mask-image: linear-gradient(to right, #000 calc(100% - 2.5rem), transparent);

    &::-webkit-scrollbar { display: none; }
  }

  .admin-nav-link {
    flex-shrink: 0;
    white-space: nowrap;
  }

  .admin-main {
    padding: 1.25rem 1rem;
  }
}
</style>
