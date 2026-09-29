import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'

const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,19}$/

interface ProfilePatchBody {
  username?: string
  display_name?: string
  bio?: string
  avatar_url?: string
  leaderboard_opt_out?: boolean
  show_online_status?: boolean
  show_read_receipts?: boolean
  hide_from_search?: boolean
  birth_year?: number | null
  gender?: string | null
  show_age?: boolean
  show_gender?: boolean
}

const GENDERS = ['man', 'woman', 'trans', 'non_binary', 'other']

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const body = await readBody<ProfilePatchBody>(event)

  const allowed: ProfilePatchBody = {}
  if (body.username !== undefined) {
    const username = body.username.trim().toLowerCase()
    if (!USERNAME_PATTERN.test(username)) {
      throw createError({ statusCode: 400, message: 'Username must be 3-20 characters, start with a letter, and contain only lowercase letters, numbers, and underscores' })
    }
    allowed.username = username
  }
  if (body.display_name !== undefined) {
    const name = body.display_name.trim()
    if (name.length > 50) throw createError({ statusCode: 400, message: 'Display name too long (max 50)' })
    allowed.display_name = name || null as unknown as string
  }
  if (body.bio !== undefined) {
    const bio = body.bio.trim()
    if (bio.length > 500) throw createError({ statusCode: 400, message: 'Bio too long (max 500)' })
    allowed.bio = bio || null as unknown as string
  }
  if (body.avatar_url !== undefined) {
    const url = body.avatar_url.trim()
    // Only a photo from our own avatars bucket: an arbitrary URL would let
    // anyone make every viewer's browser load a third-party image.
    const bucket = `${useRuntimeConfig().public.supabaseUrl}/storage/v1/object/public/avatars/${user.id}/`
    if (url && !url.startsWith(bucket)) {
      throw createError({ statusCode: 400, message: 'Avatar must be a photo uploaded to ChastHub' })
    }
    allowed.avatar_url = url || null as unknown as string
  }
  if (body.leaderboard_opt_out !== undefined) {
    if (typeof body.leaderboard_opt_out !== 'boolean') throw createError({ statusCode: 400, message: 'leaderboard_opt_out must be boolean' })
    allowed.leaderboard_opt_out = body.leaderboard_opt_out
  }
  if (body.show_online_status !== undefined) {
    if (typeof body.show_online_status !== 'boolean') throw createError({ statusCode: 400, message: 'show_online_status must be boolean' })
    allowed.show_online_status = body.show_online_status
  }
  if (body.show_read_receipts !== undefined) {
    if (typeof body.show_read_receipts !== 'boolean') throw createError({ statusCode: 400, message: 'show_read_receipts must be boolean' })
    allowed.show_read_receipts = body.show_read_receipts
  }
  if (body.hide_from_search !== undefined) {
    if (typeof body.hide_from_search !== 'boolean') throw createError({ statusCode: 400, message: 'hide_from_search must be boolean' })
    allowed.hide_from_search = body.hide_from_search
  }

  if (body.birth_year !== undefined) {
    if (body.birth_year === null) {
      allowed.birth_year = null
    }
    else {
      const year = Number(body.birth_year)
      const maxYear = new Date().getUTCFullYear() - 18
      if (!Number.isInteger(year) || year < 1920 || year > maxYear) {
        throw createError({ statusCode: 400, message: `Birth year must be between 1920 and ${maxYear}` })
      }
      allowed.birth_year = year
    }
  }
  if (body.gender !== undefined) {
    if (body.gender !== null && !GENDERS.includes(body.gender)) {
      throw createError({ statusCode: 400, message: 'Unknown gender value' })
    }
    allowed.gender = body.gender
  }
  for (const key of ['show_age', 'show_gender'] as const) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== 'boolean') throw createError({ statusCode: 400, message: `${key} must be boolean` })
      allowed[key] = body[key]
    }
  }

  if (Object.keys(allowed).length === 0) throw createError({ statusCode: 400, message: 'Nothing to update' })

  const supabase = useSupabaseAdmin()
  const { data, error } = await supabase
    .from('profiles')
    .update(allowed)
    .eq('id', user.id)
    // TASK-162 — the whole row, the same thing fetchProfile loads at login.
    // The client stores this with setProfile(), which replaces the profile;
    // a narrowed list dropped is_admin / admin_level, and an admin who saved
    // anything here lost the admin area until they reloaded. It is only the
    // caller's own row.
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') throw createError({ statusCode: 409, message: 'Username is already taken' })
    throw createError({ statusCode: 500, message: 'Failed to update profile' })
  }

  return data
})
