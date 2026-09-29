import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { generateUniqueDisplayName } from '~/server/utils/displayName'
import { requireAdminLevel, requireAuth } from '~/server/utils/auth'
import { logAudit } from '~/server/utils/auditLog'
import type { AdminLevel } from '~/types'

const VALID_LEVELS: AdminLevel[] = ['super_admin', 'support', 'analyst']

// For an exact, case-insensitive match with ilike: "_" is common in email
// addresses and would otherwise match any single character.
function likeLiteral(value: string) {
  return value.replace(/[\\%_]/g, '\\$&')
}

export default defineEventHandler(async (event) => {
  const { user: adminUser, adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['super_admin'])

  const body = await readBody<{ email?: string; admin_level?: AdminLevel }>(event)
  const email = body?.email?.trim().toLowerCase()
  const level = body?.admin_level

  if (!email || !level || !VALID_LEVELS.includes(level)) {
    throw createError({ statusCode: 400, message: 'email and a valid admin_level are required' })
  }

  const supabase = useSupabaseAdmin()

  // TASK-181 — this used to go straight to inviteUserByEmail, which refuses
  // any address that already has an account, so an existing member could
  // never be made an admin: every attempt came back 409 "Email already in
  // use". An existing account is now promoted in place.
  const { data: existing, error: lookupError } = await supabase
    .from('profiles')
    .select('id, status, is_admin, admin_level')
    .ilike('email', likeLiteral(email))
    .maybeSingle<{ id: string; status: string; is_admin: boolean; admin_level: AdminLevel | null }>()

  if (lookupError) {
    console.error('[admin/admins] profile lookup failed:', lookupError)
    throw createError({ statusCode: 500, message: 'Failed to look up that email' })
  }

  if (existing) {
    if (existing.is_admin) {
      throw createError({
        statusCode: 409,
        message: `Already an admin (${existing.admin_level ?? 'no level'}). To change the level, remove them and add them again.`,
      })
    }
    if (existing.status !== 'active') {
      throw createError({
        statusCode: 409,
        message: existing.status === 'banned'
          ? 'This account is banned. Unban it before making it an admin.'
          : 'This account can no longer be used.',
      })
    }

    const { error: promoteError } = await supabase
      .from('profiles')
      .update({ is_admin: true, admin_level: level })
      .eq('id', existing.id)

    if (promoteError) {
      console.error('[admin/admins] promote failed:', promoteError)
      throw createError({ statusCode: 500, message: 'Failed to grant admin access' })
    }

    await logAudit(supabase, 'admin_invited', adminUser.id, existing.id, { email, admin_level: level, existing_account: true })

    return { success: true, userId: existing.id, promoted: true }
  }

  const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email)

  if (inviteError) {
    // No profile, but a login exists: someone who started signing up (e.g.
    // Google) and never picked a role. Signing in once finishes that.
    const isDuplicate = inviteError.message.toLowerCase().includes('already')
      || inviteError.message.toLowerCase().includes('registered')
    throw createError({
      statusCode: isDuplicate ? 409 : 500,
      message: isDuplicate
        ? 'This email has a login but never finished signing up. Ask them to sign in once, then add them again.'
        : 'Failed to invite user',
    })
  }

  // TASK-132 — an invited admin used to land here with display_name NULL,
  // the same gap Google sign-in had: nothing on this path ever set one.
  const displayName = await generateUniqueDisplayName(supabase)

  // The auth.users trigger that used to pre-create this row is gone
  // (migration 056); the upsert stays so a re-invite of a half-created
  // account still succeeds.
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: invited.user.id,
      email,
      role: 'loqee',
      display_name: displayName,
      is_admin: true,
      admin_level: level,
    }, { onConflict: 'id' })

  if (profileError) {
    await supabase.auth.admin.deleteUser(invited.user.id)
    console.error('[admin/admins] profile upsert failed:', profileError)
    throw createError({ statusCode: 500, message: 'Failed to grant admin access' })
  }

  await logAudit(supabase, 'admin_invited', adminUser.id, invited.user.id, { email, admin_level: level })

  return { success: true, userId: invited.user.id, promoted: false }
})
