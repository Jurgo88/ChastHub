<template>
  <div class="upgrade-page">
    <div class="upgrade-container">
      <h1 class="upgrade-title">Upgrade to Premium</h1>
      <p class="upgrade-subtitle">Unlock the full ChastHub experience</p>

      <div v-if="isSubscribed" class="current-plan-card">
        <div class="current-plan-header">
          <span class="current-badge">Active</span>
          <h2>Premium Plan</h2>
        </div>
        <p class="current-plan-detail" v-if="subscription?.current_period_end">
          Renews {{ formatDate(subscription.current_period_end) }}
        </p>
        <button
          class="btn btn-outline btn-danger"
          :disabled="cancelling"
          @click="handleCancel"
        >
          {{ cancelling ? 'Cancelling…' : 'Cancel subscription' }}
        </button>
        <p v-if="cancelMessage" class="cancel-message">{{ cancelMessage }}</p>
      </div>

      <!-- Payments not live yet: show the free-trial state instead of plans
           whose checkout would fail (migration 001). -->
      <div v-else-if="!paymentsEnabled" class="current-plan-card">
        <div class="current-plan-header">
          <span class="current-badge">{{ authStore.isOnTrial ? 'Free trial' : 'Trial ended' }}</span>
          <h2>{{ authStore.isOnTrial ? 'You have full access' : 'Paid plans are coming soon' }}</h2>
        </div>
        <p class="current-plan-detail">
          <template v-if="authStore.isOnTrial">
            Your free trial ends in {{ authStore.trialDays }} {{ authStore.trialDays === 1 ? 'day' : 'days' }}.
            Paid plans are on the way. You will never be charged unless you choose to subscribe.
          </template>
          <template v-else>
            Thanks for trying ChastHub. Subscriptions for wearers are launching soon.
            Browsing keyholders, messages and your profile stay free in the meantime.
          </template>
        </p>
      </div>

      <div v-else class="plans-grid">
        <div
          v-for="plan in PLANS"
          :key="plan.id"
          class="plan-card"
          :class="{ 'plan-card--featured': plan.id === 'yearly' }"
        >
          <div v-if="plan.badge" class="plan-badge">{{ plan.badge }}</div>
          <h2 class="plan-name">{{ plan.label }}</h2>
          <div class="plan-pricing">
            <span class="plan-price">{{ plan.price }}</span>
            <span class="plan-period">{{ plan.period }}</span>
          </div>
          <ul class="plan-features">
            <li>Unlimited locks</li>
            <li>Real-time chat</li>
            <li>Lock history</li>
            <li>Priority support</li>
          </ul>
          <button
            class="btn btn-primary"
            :disabled="loadingPlan === plan.id"
            @click="handleCheckout(plan.id)"
          >
            {{ loadingPlan === plan.id ? 'Redirecting…' : 'Get started' }}
          </button>
        </div>
      </div>

      <p v-if="error" class="error-message">{{ error }}</p>

      <NuxtLink to="/dashboard" class="back-link">← Back to dashboard</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { isSubscribed, paymentsEnabled, PLANS, createCheckout, fetchStatus, cancelSubscription } = useSubscription()
const authStore = useAuthStore()

const subscription = ref<Awaited<ReturnType<typeof fetchStatus>>>(null)
const loadingPlan = ref<string | null>(null)
const cancelling = ref(false)
const cancelMessage = ref('')
const error = ref('')

onMounted(async () => {
  subscription.value = await fetchStatus()
})

async function handleCheckout(plan: 'monthly' | 'yearly') {
  error.value = ''
  loadingPlan.value = plan
  try {
    await createCheckout(plan)
  }
  catch {
    error.value = 'Failed to start checkout. Please try again.'
    loadingPlan.value = null
  }
}

async function handleCancel() {
  if (!confirm('Are you sure? You will keep access until the end of the current billing period.')) return
  cancelling.value = true
  error.value = ''
  try {
    await cancelSubscription()
    cancelMessage.value = 'Your subscription will cancel at the end of the current period.'
  }
  catch {
    error.value = 'Failed to cancel subscription. Please try again.'
  }
  finally {
    cancelling.value = false
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
</script>

<style lang="scss" scoped>
.upgrade-page {
  /* TASK-153 — see .dash in _loq-card.scss: the default layout owns the
     viewport height now, so claiming it here too pushed the footer a full
     screen below the content. */
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  background: var(--color-bg);
}

.upgrade-container {
  width: 100%;
  max-width: 720px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
}

.upgrade-title {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
  text-align: center;
}

.upgrade-subtitle {
  color: var(--color-text-muted);
  margin: 0;
  text-align: center;
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
  width: 100%;
}

.plan-card {
  position: relative;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 1rem;
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;

  &--featured {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 1px var(--color-accent);
  }
}

.plan-badge {
  position: absolute;
  top: -0.75rem;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  white-space: nowrap;
}

.plan-name {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.plan-pricing {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
}

.plan-price {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-accent);
}

.plan-period {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.plan-features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  li {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    padding-left: 1.25rem;
    position: relative;

    &::before {
      content: '✓';
      position: absolute;
      left: 0;
      color: var(--color-accent);
      font-weight: 600;
    }
  }
}

.current-plan-card {
  width: 100%;
  background: var(--color-surface);
  border: 1px solid var(--color-accent);
  border-radius: 1rem;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.current-plan-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;

  h2 {
    margin: 0;
    font-size: 1.25rem;
  }
}

.current-badge {
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
}

.current-plan-detail {
  color: var(--color-text-muted);
  font-size: 0.9rem;
  margin: 0;
}

.cancel-message {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin: 0;
}

.error-message {
  color: var(--color-danger);
  font-size: 0.9rem;
  margin: 0;
  text-align: center;
}

.back-link {
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: 0.9rem;

  &:hover {
    color: var(--color-text);
  }
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &-primary {
    background: var(--color-accent);
    color: var(--color-on-accent);

    &:hover:not(:disabled) {
      opacity: 0.9;
    }
  }

  &-outline {
    background: transparent;
    border: 1px solid currentColor;
  }

  &-danger {
    color: var(--color-danger);

    &:hover:not(:disabled) {
      background: rgba(229, 62, 62, 0.08);
    }
  }
}
</style>
