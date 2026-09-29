import type { Loq, LoqRequest } from '~/types'
import { LoqApiError } from '~/composables/useLoq'

type FetchError = { data?: { message?: string }; status?: number; statusCode?: number }

function extractError(err: unknown): LoqApiError {
  const fe = err as FetchError
  const statusCode = fe?.status ?? fe?.statusCode ?? 500
  const message = fe?.data?.message ?? (err as Error)?.message ?? 'Something went wrong. Please try again.'
  return new LoqApiError(message, statusCode)
}

export function useLoqholder() {
  const { authFetch } = useAuthFetch()

  async function acceptLoq(id: string): Promise<Loq> {
    try {
      return await authFetch<Loq>(`/api/loqs/${id}/accept`, { method: 'POST' })
    }
    catch (err) { throw extractError(err) }
  }

  async function rejectLoq(id: string): Promise<LoqRequest> {
    try {
      return await authFetch<LoqRequest>(`/api/loqs/${id}/reject`, { method: 'POST' })
    }
    catch (err) { throw extractError(err) }
  }

  async function togglePause(id: string): Promise<Loq> {
    try {
      return await authFetch<Loq>(`/api/loqs/${id}/pause`, { method: 'POST' })
    }
    catch (err) { throw extractError(err) }
  }

  async function endLoq(id: string): Promise<Loq> {
    try {
      return await authFetch<Loq>(`/api/loqs/${id}/end`, { method: 'POST' })
    }
    catch (err) { throw extractError(err) }
  }

  async function adjustTime(id: string, deltaMinutes: number): Promise<Loq> {
    try {
      return await authFetch<Loq>(`/api/loqs/${id}/time`, { method: 'POST', body: { delta_minutes: deltaMinutes } })
    }
    catch (err) { throw extractError(err) }
  }

  async function generateVisitorLink(id: string): Promise<{ public_link_id: string }> {
    try {
      return await authFetch<{ public_link_id: string }>(`/api/loqs/${id}/visitor-link`, { method: 'POST' })
    }
    catch (err) { throw extractError(err) }
  }

  async function setVisitorAmount(id: string, hours: number): Promise<{ visitor_add_hours: number }> {
    try {
      return await authFetch<{ visitor_add_hours: number }>(`/api/loqs/${id}/visitor-amount`, { method: 'POST', body: { hours } })
    }
    catch (err) { throw extractError(err) }
  }

  // TASK-089
  async function setVisitorPermission(id: string, permission: 'add' | 'remove' | 'both'): Promise<{ visitor_permission: string }> {
    try {
      return await authFetch<{ visitor_permission: string }>(`/api/loqs/${id}/visitor-permission`, { method: 'POST', body: { permission } })
    }
    catch (err) { throw extractError(err) }
  }

  return { acceptLoq, rejectLoq, togglePause, endLoq, adjustTime, generateVisitorLink, setVisitorAmount, setVisitorPermission }
}
