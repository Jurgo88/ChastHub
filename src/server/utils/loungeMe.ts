import type { AdminLevel, LoungeMe, LoungeStatus } from '~/types'
import { useSupabaseAdmin } from '~/server/utils/supabaseAdmin'
import { isLoungeModerator, type LoungeSettingsRow } from '~/server/utils/lounge'

/** What the caller may do in the Lounge right now, and why not. */
export async function getLoungeMe(
  userId: string,
  adminLevel: AdminLevel | null,
  status: LoungeStatus,
  settings: LoungeSettingsRow,
): Promise<LoungeMe> {
  const supabase = useSupabaseAdmin()
  const moderator = isLoungeModerator(adminLevel)

  const [{ data: profile }, { data: mute }, { data: last }, { data: reminder }] = await Promise.all([
    supabase.from('profiles').select('created_at').eq('id', userId).maybeSingle(),
    supabase.from('lounge_mutes').select('muted_until').eq('user_id', userId).gt('muted_until', new Date().toISOString()).maybeSingle(),
    supabase.from('lounge_messages').select('created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    status.next
      ? supabase.from('lounge_reminders').select('session_start').eq('user_id', userId).eq('session_start', status.next.start).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const ageHours = profile?.created_at ? (Date.now() - new Date(profile.created_at).getTime()) / 3_600_000 : 0
  let blocked: string | null = null
  if (!moderator) {
    if (!status.enabled) blocked = 'The Lounge is not open yet.'
    else if (!status.open) blocked = 'The Lounge is closed right now.'
    else if (mute) blocked = 'A moderator muted you in the Lounge for now.'
    else if (ageHours < settings.min_account_age_hours) {
      const left = Math.ceil(settings.min_account_age_hours - ageHours)
      blocked = `New accounts can write after ${settings.min_account_age_hours} hours. About ${left}h to go, you can read along until then.`
    }
  }

  return {
    can_post: !blocked,
    blocked_reason: blocked,
    muted_until: mute?.muted_until ?? null,
    moderator,
    reminder_for: reminder?.session_start ?? null,
    last_post_at: last?.created_at ?? null,
  }
}
