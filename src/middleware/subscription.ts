// TASK-056 — loqee subscription gate.
// Redirects a loqee without premium access (paid subscription or running
// free trial) to the upgrade page.
// Loqholders are never gated (they don't create loqs). Pair with `auth`,
// e.g. definePageMeta({ middleware: ['auth', 'subscription'] }).
export default defineNuxtRouteMiddleware(() => {
  const authStore = useAuthStore()
  if (authStore.isLoqee && !authStore.hasAccess) {
    return navigateTo('/subscription/upgrade')
  }
})
