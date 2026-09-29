export default defineNuxtRouteMiddleware(() => {
  const authStore = useAuthStore()
  if (!authStore.isAuthenticated) return navigateTo('/auth/login')
  if (authStore.profile?.status === 'banned') return navigateTo('/auth/login')
})
