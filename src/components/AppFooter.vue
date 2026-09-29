<template>
  <footer class="app-footer">
    <div class="app-footer__links">
      <span class="app-footer__age">18+</span>

      <nav class="app-footer__nav" aria-label="Footer">
        <NuxtLink to="/install" class="app-footer__link">Get the app</NuxtLink>
        <NuxtLink to="/faq" class="app-footer__link">FAQ</NuxtLink>
        <NuxtLink to="/terms" class="app-footer__link">Terms</NuxtLink>
        <NuxtLink to="/privacy" class="app-footer__link">Privacy</NuxtLink>
        <!-- TASK-172 — bugs and security issues, one form. -->
        <NuxtLink to="/report" class="app-footer__link">Report issue</NuxtLink>
        <a href="mailto:founder@chasthub.com" class="app-footer__link">Contact</a>
      </nav>
    </div>

    <div class="app-footer__legal">
      <span>© {{ year }} ChastHub</span>
      <span>
        Created by
        <a
          href="https://projentiq.com/"
          target="_blank"
          rel="noopener me"
          class="app-footer__credit"
        >Projentiq</a>
      </span>
    </div>
  </footer>
</template>

<script setup lang="ts">
// TASK-153 — this footer appears on every page of an app people use daily, so
// the bar for including anything is that it is not already one tap away.
//
// What that rules out: the wordmark (AppNav renders it directly above this, on
// every page), and Discover / Leaderboard / Shop / Profile, all of which are
// nav entries. Repeating them costs height on every screen and teaches people
// that the footer holds nothing new.
//
// What is left is exactly what the nav does not carry. /install especially:
// TASK-122 removed "Get the app" from the nav entirely, leaving it reachable
// only from the profile page — and installing is what unlocks push on iOS,
// so it is worth one link here.
//
// No store access and no props: it renders identically signed in or out,
// which is what keeps it cheap on a page that already has plenty to do.
const year = new Date().getFullYear()
</script>

<style scoped lang="scss">
.app-footer {
  /* Page background rather than --color-surface. A footer lighter than the
     content pulls the eye downward, which is the opposite of what a footer
     should do — one hairline is enough to separate it. */
  background: var(--color-bg);
  border-top: 1px solid var(--color-border);

  &__links,
  &__legal {
    max-width: 760px;
    margin: 0 auto;
    padding-inline: 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem 1.5rem;
    flex-wrap: wrap;
  }

  &__links {
    padding-block: 0.875rem;
  }

  &__nav {
    display: flex;
    align-items: center;
    gap: 0.25rem 1.5rem;
    flex-wrap: wrap;
  }

  /* The one spot of colour down here, and it earns it: an age signal is worth
     stating plainly on an 18+ platform rather than burying it in the Terms. */
  &__age {
    flex-shrink: 0;
    padding: 0.125rem 0.375rem;
    border: 1px solid rgba(var(--color-accent-rgb), 0.45);
    border-radius: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--color-accent);
  }

  &__link {
    /* Vertical padding rather than a min-height: it lifts the tap target to a
       usable size on a phone without making the row taller than its text on
       a desktop, where the row is a single line either way. */
    padding: 0.375rem 0;
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    text-decoration: none;
    transition: color 0.15s;

    &:hover,
    &:focus-visible {
      color: var(--color-accent);
    }
  }

  &__legal {
    justify-content: space-between;
    padding-block: 0.625rem;
    border-top: 1px solid var(--color-border);
    font-size: 0.6875rem;
    color: var(--color-muted);
  }

  /* A shade brighter than the line it sits in, so it reads as a link without
     competing with the navigation above it. */
  &__credit {
    color: var(--color-text-muted);
    text-decoration: none;
    transition: color 0.15s;

    &:hover,
    &:focus-visible {
      color: var(--color-accent);
    }
  }
}

@media (max-width: 560px) {
  .app-footer {
    &__links {
      /* The 18+ chip leads the row on desktop; centred under a stack of
         wrapped links it would look stranded, so everything centres together. */
      justify-content: center;
      gap: 0.5rem 1.25rem;
    }

    &__nav {
      justify-content: center;
      gap: 0.25rem 1.25rem;
    }

    &__legal {
      justify-content: center;
      gap: 0.25rem 0.75rem;
    }
  }
}
</style>
