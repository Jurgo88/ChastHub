const AVATAR_BUCKET = 'avatars'

export class AvatarUploadError extends Error {}

export async function uploadAvatarPhoto(file: File): Promise<string> {
  const { $supabase } = useNuxtApp()
  const authStore = useAuthStore()
  const userId = authStore.profile?.id
  if (!userId) throw new AvatarUploadError('Not authenticated')

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${userId}/${Date.now()}.${ext}`

  const { error } = await $supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: false })

  if (error) throw new AvatarUploadError(error.message)

  const { data } = $supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
