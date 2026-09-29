import { defineStore } from 'pinia'
import type { Loq } from '~/types'

export const useLoqStore = defineStore('loq', () => {
  const currentLoq = ref<Loq | null>(null)

  const hasActiveLoq = computed(() =>
    !!currentLoq.value && ['draft', 'pending', 'active', 'paused'].includes(currentLoq.value.status),
  )
  const isPending = computed(() => currentLoq.value?.status === 'pending')
  const isActive = computed(() => currentLoq.value?.status === 'active')
  const isPaused = computed(() => currentLoq.value?.status === 'paused')
  const isLoqed = computed(() => currentLoq.value?.locked === true)

  function setCurrentLoq(loq: Loq | null) {
    currentLoq.value = loq
  }

  function clear() {
    currentLoq.value = null
  }

  return { currentLoq, hasActiveLoq, isPending, isActive, isPaused, isLoqed, setCurrentLoq, clear }
})
