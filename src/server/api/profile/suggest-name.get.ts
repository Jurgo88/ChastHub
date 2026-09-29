import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { generateUniqueDisplayName, usernameFromDisplayName } from '~/server/utils/displayName'

// A fresh name for the /welcome step and the "roll again" button, themed to
// the caller's role. Nothing is saved here; PATCH /api/profile does that.
export default defineEventHandler(async (event) => {
  const { role } = await requireAuth(event)
  const displayName = await generateUniqueDisplayName(useSupabaseAdmin(), role)
  return { display_name: displayName, username: usernameFromDisplayName(displayName) }
})
