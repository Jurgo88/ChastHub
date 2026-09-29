import type { FavoriteEntry } from '~/types'

export function useFavorites() {
  const { authFetch } = useAuthFetch()

  async function fetchFavorites(): Promise<FavoriteEntry[]> {
    const res = await authFetch<{ favorites: FavoriteEntry[] }>('/api/favorites')
    return res.favorites
  }

  async function addFavorite(profileId: string): Promise<void> {
    await authFetch('/api/favorites', { method: 'POST', body: { profile_id: profileId } })
  }

  async function removeFavorite(profileId: string): Promise<void> {
    await authFetch(`/api/favorites/${profileId}`, { method: 'DELETE' })
  }

  return { fetchFavorites, addFavorite, removeFavorite }
}
