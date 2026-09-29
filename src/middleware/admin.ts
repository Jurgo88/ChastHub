import type { AdminLevel } from '~/types'

export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()

  if (!authStore.isAuthenticated) {
    return navigateTo('/auth/login')
  }

  if (!authStore.isAdmin || authStore.profile?.status === 'banned') {
    return navigateTo('/dashboard')
  }

  const requiredLevels = to.meta.adminLevel as AdminLevel[] | undefined
  const level = authStore.profile?.admin_level
  if (requiredLevels && (!level || !requiredLevels.includes(level))) {
    return navigateTo('/dashboard')
  }
})
