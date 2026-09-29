import type { Subscription } from '~/types'

export function useSubscription() {
  const { authFetch } = useAuthFetch()
  const authStore = useAuthStore()

  const isSubscribed = computed(() => authStore.profile?.subscription_status === 'active')
  // Payments switch on by setting the Stripe keys. Until then the upgrade page
  // shows the free-trial state instead of a checkout that would fail.
  const paymentsEnabled = !!useRuntimeConfig().public.stripePublishableKey

  // Price IDs live server-side. Client only references plan names.
  const PLANS = [
    { id: 'monthly' as const, label: 'Monthly', price: '€5', period: '/month' },
    { id: 'yearly' as const, label: 'Annual', price: '€50', period: '/year', badge: 'Save 17%' },
  ]

  async function createCheckout(plan: 'monthly' | 'yearly'): Promise<void> {
    const { url } = await authFetch<{ url: string }>('/api/subscription/checkout', {
      method: 'POST',
      body: { plan, returnUrl: window.location.origin },
    })
    window.location.href = url
  }

  async function fetchStatus(): Promise<Subscription | null> {
    const { subscription } = await authFetch<{ subscription: Subscription | null }>(
      '/api/subscription/status',
    )
    return subscription
  }

  async function cancelSubscription(): Promise<void> {
    await authFetch('/api/subscription/cancel', { method: 'POST' })
  }

  return { isSubscribed, paymentsEnabled, PLANS, createCheckout, fetchStatus, cancelSubscription }
}
