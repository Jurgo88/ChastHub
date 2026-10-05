import type { Loq, VisitorPermission } from '~/types'

type FetchError = { data?: { message?: string }; status?: number; statusCode?: number }

const COMBINATION_PHOTO_BUCKET = 'combination-photos'

export class LoqApiError extends Error {
  statusCode: number
  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
  }
}

function extractError(err: unknown): LoqApiError {
  const fe = err as FetchError
  const statusCode = fe?.status ?? fe?.statusCode ?? 500
  const message = fe?.data?.message ?? (err as Error)?.message ?? 'Something went wrong. Please try again.'
  return new LoqApiError(message, statusCode)
}

export async function uploadCombinationPhoto(file: File): Promise<string> {
  const { $supabase } = useNuxtApp()
  const authStore = useAuthStore()
  const userId = authStore.profile?.id
  if (!userId) throw new LoqApiError('Not authenticated', 401)

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${userId}/${Date.now()}.${ext}`

  const { data, error } = await $supabase.storage
    .from(COMBINATION_PHOTO_BUCKET)
    .upload(path, file, { upsert: false })

  if (error) throw new LoqApiError(error.message, 500)

  return data.path
}

export function useLoq() {
  const { authFetch } = useAuthFetch()
  const loqStore = useLoqStore()

  async function fetchCurrentLoq(): Promise<Loq | null> {
    try {
      const loq = await authFetch<Loq | null>('/api/loqs/current')
      loqStore.setCurrentLoq(loq)
      return loq
    }
    catch {
      loqStore.setCurrentLoq(null)
      return null
    }
  }

  async function createLoq(data: {
    duration_minutes: number
    combination_text?: string
    combination_photo_url?: string
    emotion?: string
    reason?: string
    self?: boolean
    visitor_permission?: 'none' | 'add' | 'remove' | 'both'
    visitor_add_hours?: number
    listed_in_discover?: boolean
  }): Promise<Loq> {
    try {
      const loq = await authFetch<Loq>('/api/loqs', { method: 'POST', body: data })
      loqStore.setCurrentLoq(loq)
      return loq
    }
    catch (err) { throw extractError(err) }
  }

  async function cancelLoq(id: string): Promise<Loq | null> {
    try {
      await authFetch(`/api/loqs/${id}/cancel`, { method: 'POST' })
      // Re-fetch (rather than clearing the store) so the loqee lands on the
      // combination-reveal state instead of losing their combination —
      // /api/loqs/current now surfaces a just-cancelled loq for this
      // purpose (TASK-084).
      return await fetchCurrentLoq()
    }
    catch (err) { throw extractError(err) }
  }

  async function acknowledgeCombination(id: string): Promise<void> {
    try {
      await authFetch(`/api/loqs/${id}/acknowledge-combination`, { method: 'POST' })
    }
    catch (err) { throw extractError(err) }
  }

  async function updateEmotion(id: string, emotion: string): Promise<Loq> {
    try {
      const updated = await authFetch<Loq>(`/api/loqs/${id}/emotion`, {
        method: 'POST',
        body: { emotion },
      })
      loqStore.setCurrentLoq(updated)
      return updated
    }
    catch (err) { throw extractError(err) }
  }

  async function requestLoqholder(id: string, loqholderId: string): Promise<void> {
    try {
      await authFetch(`/api/loqs/${id}/request`, {
        method: 'POST',
        body: { loqholder_id: loqholderId },
      })
    }
    catch (err) { throw extractError(err) }
  }

  // TASK-087 — loqee approving/rejecting a loqholder's request to join
  // their public loq (the reverse direction from requestLoqholder above).
  async function approveRequest(id: string): Promise<Loq> {
    try {
      const updated = await authFetch<Loq>(`/api/loqs/${id}/approve-request`, { method: 'POST' })
      loqStore.setCurrentLoq(updated)
      return updated
    }
    catch (err) { throw extractError(err) }
  }

  async function rejectIncomingRequest(id: string): Promise<void> {
    try {
      await authFetch(`/api/loqs/${id}/reject-request`, { method: 'POST' })
    }
    catch (err) { throw extractError(err) }
  }

  async function cancelRequest(id: string): Promise<void> {
    try {
      await authFetch(`/api/loqs/${id}/cancel-request`, { method: 'POST' })
    }
    catch (err) { throw extractError(err) }
  }

  async function publishLoq(id: string): Promise<Loq> {
    try {
      const updated = await authFetch<Loq>(`/api/loqs/${id}/publish`, { method: 'POST' })
      loqStore.setCurrentLoq(updated)
      return updated
    }
    catch (err) { throw extractError(err) }
  }

  async function unpublishLoq(id: string): Promise<Loq> {
    try {
      const updated = await authFetch<Loq>(`/api/loqs/${id}/unpublish`, { method: 'POST' })
      loqStore.setCurrentLoq(updated)
      return updated
    }
    catch (err) { throw extractError(err) }
  }

  // TASK-058 — self-loq owner pause/end (the loqholder-only endpoints now
  // also accept the loqee themself when loqholder_id is null).
  async function pauseLoq(id: string): Promise<Loq> {
    try {
      const updated = await authFetch<Loq>(`/api/loqs/${id}/pause`, { method: 'POST' })
      loqStore.setCurrentLoq(updated)
      return updated
    }
    catch (err) { throw extractError(err) }
  }

  // TASK-059 — loqee sets the per-visitor-vote amount on their own self-loq
  // (the same action a loqholder has on a paired loq).
  async function setVisitorAmount(id: string, hours: number): Promise<{ visitor_add_hours: number }> {
    try {
      return await authFetch<{ visitor_add_hours: number }>(`/api/loqs/${id}/visitor-amount`, {
        method: 'POST',
        body: { hours },
      })
    }
    catch (err) { throw extractError(err) }
  }

  // TASK-089 — restrict visitors on the share link to add-only, remove-only,
  // or both.
  // TASK-142 — opt the loq into the Discover listing (visibility only; the
  // clock is governed separately by setVisitorPermission).
  async function setDiscoverListing(id: string, listed: boolean): Promise<Loq> {
    try {
      return await authFetch<Loq>(`/api/loqs/${id}/discover-listing`, {
        method: 'POST',
        body: { listed },
      })
    }
    catch (err) { throw extractError(err) }
  }

  async function setVisitorPermission(id: string, permission: VisitorPermission): Promise<{ visitor_permission: string }> {
    try {
      return await authFetch<{ visitor_permission: string }>(`/api/loqs/${id}/visitor-permission`, {
        method: 'POST',
        body: { permission },
      })
    }
    catch (err) { throw extractError(err) }
  }

  async function endLoq(id: string): Promise<Loq | null> {
    try {
      await authFetch(`/api/loqs/${id}/end`, { method: 'POST' })
      // Re-fetch, same reasoning as cancelLoq — lands on the combination
      // reveal instead of losing it (TASK-084's fallback covers 'ended').
      return await fetchCurrentLoq()
    }
    catch (err) { throw extractError(err) }
  }

  return {
    fetchCurrentLoq,
    createLoq,
    cancelLoq,
    acknowledgeCombination,
    updateEmotion,
    requestLoqholder,
    cancelRequest,
    publishLoq,
    unpublishLoq,
    pauseLoq,
    endLoq,
    setVisitorAmount,
    setVisitorPermission,
    setDiscoverListing,
    approveRequest,
    rejectIncomingRequest,
  }
}
