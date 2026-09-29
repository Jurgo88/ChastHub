import { defineStore } from 'pinia'
import type { Session } from '@supabase/supabase-js'
import type { Profile } from '~/types'
import { hasPremiumAccess, isTrialActive, trialDaysLeft } from '~/utils/access'

export const useAuthStore = defineStore('auth', () => {
  const profile = ref<Profile | null>(null)
  const session = ref<Session | null>(null)

  const isAuthenticated = computed(() => !!session.value)
  const isAdmin = computed(() => profile.value?.is_admin === true)
  const isSuperAdmin = computed(() => profile.value?.admin_level === 'super_admin')
  const isSupport = computed(() => profile.value?.admin_level === 'support')
  const isAnalyst = computed(() => profile.value?.admin_level === 'analyst')
  const isLoqholder = computed(() => profile.value?.role === 'loqholder')
  const isLoqee = computed(() => profile.value?.role === 'loqee')
  // Paid subscription only. For "may use premium features" use hasAccess,
  // which also counts the free trial (migration 001).
  const isSubscribed = computed(() => profile.value?.subscription_status === 'active')
  const isOnTrial = computed(() => !isSubscribed.value && isTrialActive(profile.value))
  const hasAccess = computed(() => hasPremiumAccess(profile.value))
  const trialDays = computed(() => trialDaysLeft(profile.value))

  function setProfile(p: Profile) { profile.value = p }
  function setSession(s: Session) { session.value = s }

  function clear() {
    profile.value = null
    session.value = null
  }

  return {
    profile,
    session,
    isAuthenticated,
    isAdmin,
    isSuperAdmin,
    isSupport,
    isAnalyst,
    isLoqholder,
    isLoqee,
    isSubscribed,
    isOnTrial,
    hasAccess,
    trialDays,
    setProfile,
    setSession,
    clear,
  }
})
