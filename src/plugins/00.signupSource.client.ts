// TASK-164 — read the landing URL and referrer before any navigation
// replaces them. In memory only; see composables/useSignupSource.ts.
export default defineNuxtPlugin(() => {
  captureSignupSource()
})
