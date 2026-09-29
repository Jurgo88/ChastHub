// The boards the Stats page can ask for. Keys match stats_board() in
// migration 004; anything else is rejected before it reaches the database.
export const STATS_BOARDS = [
  'wearer_longest', 'wearer_total', 'wearer_completed', 'wearer_running',
  'keyholder_locks', 'keyholder_hours', 'keyholder_wearers', 'keyholder_holding',
  'crowd', 'locktober_survivors',
] as const
export type StatsBoardKey = typeof STATS_BOARDS[number]

export const STATS_PERIODS = ['all', 'month', 'locktober'] as const
export type StatsPeriod = typeof STATS_PERIODS[number]

export const ROLE_BOARDS: Record<string, StatsBoardKey[]> = {
  loqee: ['wearer_longest', 'wearer_total', 'wearer_completed', 'wearer_running', 'crowd', 'locktober_survivors'],
  loqholder: ['keyholder_locks', 'keyholder_hours', 'keyholder_wearers', 'keyholder_holding'],
}

// Rankings change as locks run, but not second by second: a minute of CDN
// caching keeps a busy Locktober from recomputing every board per visitor.
export function cachePublicStats(event: Parameters<typeof setResponseHeader>[0]) {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=30')
  setResponseHeader(event, 'Netlify-CDN-Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
  setResponseHeader(event, 'Netlify-Vary', 'query=board|period|limit')
}
