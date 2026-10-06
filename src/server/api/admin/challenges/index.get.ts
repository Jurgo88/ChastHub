import { requireAdminLevel, requireAuth } from '~/server/utils/auth'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { CHALLENGE_COLUMNS } from '~/server/utils/challengeData'

// GET /api/admin/challenges: every challenge, active or not, with its number of entries.
export default defineEventHandler(async (event) => {
  const { adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, ['support', 'super_admin'])

  const supabase = useSupabaseAdmin()
  const [{ data: challenges }, { data: entries }] = await Promise.all([
    supabase.from('challenges').select(CHALLENGE_COLUMNS).order('created_at', { ascending: false }).limit(200),
    supabase.from('challenge_entries').select('challenge_id').limit(50000),
  ])

  const counts = new Map<string, number>()
  for (const e of entries ?? []) counts.set(e.challenge_id as string, (counts.get(e.challenge_id as string) ?? 0) + 1)
  return { challenges: (challenges ?? []).map(c => ({ ...c, participants: counts.get(c.id as string) ?? 0 })) }
})
