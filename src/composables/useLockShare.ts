import { spanHours } from '~/utils/lockHistory'

// Shares the summary image of a finished lock. The image sits behind the
// login, so it is fetched with the token and handed to the share sheet as a
// file, or saved where there is no share sheet.
export function useLockShare() {
  const { authFetch } = useAuthFetch()
  const sharing = ref(false)
  const error = ref('')

  async function shareLock(loqId: string, totalHours: number) {
    sharing.value = true
    error.value = ''
    try {
      const blob = await authFetch<Blob>(`/api/loqs/${loqId}/share-image`, { responseType: 'blob' })
      const file = new File([blob], 'chasthub-lock.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `${spanHours(totalHours)} locked on ChastHub` })
      }
      else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        a.click()
        URL.revokeObjectURL(url)
      }
    }
    catch (e) {
      if ((e as Error).name !== 'AbortError') error.value = 'Could not create the image.'
    }
    finally {
      sharing.value = false
    }
  }

  return { shareLock, sharing, error }
}
