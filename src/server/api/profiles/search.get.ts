import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { requireAuth } from '~/server/utils/auth'
import { hasPremiumAccess } from '~/utils/access'

interface SearchProfile {
  id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
  role: string
}

const LIMIT = 20

// TASK-159 — lower is better. Handles are typed on purpose, so an exact or
// prefix handle hit outranks a name that merely contains the term.
function rank(p: SearchProfile, q: string): number {
  const handle = p.username ?? ''
  const name = (p.display_name ?? '').toLowerCase()
  if (handle === q) return 0
  if (handle.startsWith(q)) return 1
  if (name.startsWith(q)) return 2
  if (name.split(/\s+/).some(w => w.startsWith(q))) return 3
  return 4
}

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)

  const query = getQuery(event)
  // `%` and `*` are wildcards to ilike and `"` / `\` would break the quoted
  // value in or() below — none of them belong in a name or a handle. A leading
  // "@" is how handles are written everywhere else in the app.
  const q = String(query.q ?? '').replace(/[%*"\\]/g, '').trim().replace(/^@/, '').toLowerCase()
  if (!q) return { profiles: [], by_name: false }
  if (q.length < 2) throw createError({ statusCode: 400, message: 'Search term must be at least 2 characters' })

  const supabase = useSupabaseAdmin()

  // Searching by display name is a subscriber feature (TASK-159). Everyone
  // else keeps the handle lookup. Never by email: that would tell anyone
  // whether a given address has an account here.
  const { data: me } = await supabase
    .from('profiles')
    .select('subscription_status, trial_ends_at, is_admin')
    .eq('id', user.id)
    .single<{ subscription_status: string; trial_ends_at: string | null; is_admin: boolean }>()
  const byName = hasPremiumAccess(me) || !!me?.is_admin

  let search = supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url, role')
    .eq('status', 'active')
    // TASK-161 — opted out in Profile → Privacy. Applies to both searches.
    .eq('hide_from_search', false)
    .neq('id', user.id)

  search = byName
    // Over-fetch, then rank here: PostgREST has no ORDER BY for "which
    // branch of the or() matched".
    ? search.or(`username.ilike."${q}%",display_name.ilike."%${q}%"`).limit(LIMIT * 3)
    : search.ilike('username', `${q}%`).order('username').limit(LIMIT)

  const { data, error } = await search
  if (error) throw createError({ statusCode: 500, message: 'Search failed' })

  const profiles = (data ?? []) as SearchProfile[]
  if (byName) {
    profiles.sort((a, b) =>
      rank(a, q) - rank(b, q)
      || (a.display_name ?? a.username ?? '').localeCompare(b.display_name ?? b.username ?? ''))
  }

  return { profiles: profiles.slice(0, LIMIT), by_name: byName }
})
