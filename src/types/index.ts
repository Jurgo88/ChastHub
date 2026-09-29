// ─── User & Auth ────────────────────────────────────────────────────────────

export type UserRole = 'loqee' | 'loqholder' | 'admin'
export type ProfileStatus = 'active' | 'banned'
export type SubscriptionStatusProfile = 'inactive' | 'active'
export type AdminLevel = 'super_admin' | 'support' | 'analyst'

export interface Profile {
  id: string
  email: string
  role: UserRole
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  subscription_status: SubscriptionStatusProfile
  trial_ends_at: string | null
  status: ProfileStatus
  leaderboard_opt_out: boolean
  last_seen_at: string | null
  show_online_status: boolean
  hide_from_search: boolean
  birth_year: number | null
  gender: Gender | null
  show_age: boolean
  show_gender: boolean
  is_admin: boolean
  admin_level: AdminLevel | null
  terms_accepted_at: string | null
  signup_country: string | null
  signup_region: string | null
  signup_timezone: string | null
  signup_locale: string | null
  created_at: string
}

// Public-safe subset returned by GET /api/profiles/{username} — never
// includes email/subscription_status/status (see that route for why).
export interface PublicProfile {
  id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
  bio: string | null
  role: UserRole
  is_admin: boolean
  is_self: boolean
  is_favorited: boolean
  last_seen_at: string | null
  show_online_status?: boolean
  created_at: string
  /** Only present when the owner shows it. */
  age: number | null
  gender: Gender | null
  stats: ProfileStats
}

export type Gender = 'man' | 'woman' | 'trans' | 'non_binary' | 'other'

export interface ProfileStats {
  role: UserRole
  /** Wearer: ended locks that had a keyholder. Keyholder: ended locks they held. */
  locks_completed: number
  /** Wearer: hours across completed locks. Keyholder: hours they controlled. */
  total_hours: number
  /** Wearer only: longest completed lock in hours. */
  longest_hours: number
  /** Keyholder only: locks they hold right now. */
  holding_now: number
  /** Position on the leaderboard for the user's role, null when unlisted. */
  rank: number | null
  /** Wearer only: the running lock, when it is public. */
  public_lock: { public_id: string; ends_at: string | null; paused: boolean; visitor_permission: string } | null
}

export interface FavoriteEntry {
  favorite_id: string
  created_at: string
  profile: {
    id: string
    display_name: string | null
    username: string | null
    avatar_url: string | null
    role: UserRole
  }
}

// ─── Subscription ────────────────────────────────────────────────────────────

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing'

export interface Subscription {
  id: string
  user_id: string
  stripe_customer_id: string
  stripe_subscription_id: string
  status: SubscriptionStatus
  current_period_end: string
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

// ─── Loq (V2) ────────────────────────────────────────────────────────────────

export type LoqStatus = 'draft' | 'pending' | 'active' | 'paused' | 'ended' | 'cancelled'
// TASK-070: free-form custom emoji (was a fixed 5-value union) — the value
// stored is the emoji character itself now, not a lookup key.
export type EmotionKey = string

// 'none' — listed in Discover, but the clock is untouchable (TASK-142).
export type VisitorPermission = 'none' | 'add' | 'remove' | 'both'

export interface Loq {
  id: string
  loqee_id: string
  loqholder_id: string | null
  status: LoqStatus
  duration_minutes: number
  combination_text: string | null
  combination_photo_url: string | null
  emotion: EmotionKey | null
  reason: string | null
  // "Published, looking for a loqholder" — distinct from listed_in_discover,
  // which is visibility. A self-loq wants the second and never the first.
  is_public: boolean
  listed_in_discover: boolean
  loqed_until: string | null
  locked: boolean
  public_link_id: string | null
  visitor_add_hours: number
  visitor_permission?: VisitorPermission
  visitor_count?: number
  paused_at: string | null
  created_at: string
  accepted_at: string | null
  ended_at: string | null
  pending_requests?: number
  pending_request?: { id: string; loqholder: { id: string; display_name: string | null; avatar_url: string | null } } | null
}

export type LoqRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'auto_rejected'

export interface LoqRequest {
  id: string
  loq_id: string
  loqholder_id: string
  status: LoqRequestStatus
  created_at: string
  responded_at: string | null
}

export interface LoqMessage {
  id: string
  loq_id: string
  sender_id: string
  content: string
  created_at: string
}

// ─── Direct messaging (standalone, TASK-067) ──────────────────────────────────

export type ConversationStatus = 'pending' | 'accepted' | 'declined'

export interface ConversationParticipant {
  id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
  role: UserRole
  last_seen_at: string | null
}

export interface Conversation {
  id: string
  status: ConversationStatus
  is_requester: boolean
  created_at: string
  responded_at: string | null
  last_message_at: string | null
  last_message: { content: string; sender_id: string } | null
  other_user: ConversationParticipant | null
}

export interface DmMessage {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
}

// ─── Admin / Reports ─────────────────────────────────────────────────────────

export type ReportStatus = 'open' | 'resolved' | 'dismissed'

export interface Report {
  id: string
  reported_user_id: string
  reported_by_id: string
  reason: string
  description: string | null
  status: ReportStatus
  created_at: string
  resolved_at: string | null
}

// ─── API Responses ───────────────────────────────────────────────────────────

export interface ApiError {
  statusCode: number
  message: string
}

// ── Stats page (/stats, migration 004) ───────────────────────────────────────

export type StatsBoardKey =
  | 'wearer_longest' | 'wearer_total' | 'wearer_completed' | 'wearer_running'
  | 'keyholder_locks' | 'keyholder_hours' | 'keyholder_wearers' | 'keyholder_holding'
  | 'crowd' | 'locktober_survivors'

export type StatsPeriod = 'all' | 'month' | 'locktober'

export interface StatsRow {
  rank: number
  id: string
  display_name: string
  username: string | null
  avatar_url: string | null
  value: number
  self_lock: boolean
  since: string | null
}

export interface StatsMeRow extends StatsRow {
  /** Value of the person one place above, null when you are first. */
  next_value: number | null
  /** How many people rank below you. */
  below: number
}

export interface StatsBoard {
  board: StatsBoardKey
  period: StatsPeriod
  total: number
  rows: StatsRow[]
  me: StatsMeRow | null
}

export interface StatsPulse {
  locked_now: number
  hours_this_month: number
  done_this_week: number
  keyholders_active: number
  keydrop_waiting: number
  locktober: {
    year: number
    active: boolean
    day: number | null
    starters: number
    survivors: number
    joined: number
  }
}

export interface StatsMe {
  hidden: boolean
  role: UserRole
  boards: Partial<Record<StatsBoardKey, { total: number; me: StatsMeRow | null }>>
}
