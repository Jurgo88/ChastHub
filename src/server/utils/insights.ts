import type { H3Event } from 'h3'
import { useSupabaseAdmin } from './supabaseAdmin'
import { requireAdminLevel, requireAuth } from './auth'
import type { AdminLevel } from '~/types'

export const ALL_ADMIN_LEVELS: AdminLevel[] = ['analyst', 'support', 'super_admin']

/**
 * The admin Insights sections (TASK-185…189) all work the same way: gate on
 * admin level, call one SQL function, hand its JSON back. A missing function
 * (the migration not applied yet) gets a message that says which one.
 */
export async function runInsight(
  event: H3Event,
  fn: string,
  migration: string,
  levels: AdminLevel[] = ALL_ADMIN_LEVELS,
) {
  const { adminLevel } = await requireAuth(event)
  requireAdminLevel(adminLevel, levels)

  const { data, error } = await useSupabaseAdmin().rpc(fn)
  if (error) {
    console.error(`[insights] ${fn}`, error.message)
    const missing = /PGRST202|does not exist|Could not find the function/i.test(`${error.code} ${error.message}`)
    throw createError({
      statusCode: 500,
      message: missing ? `Not set up yet — apply migration ${migration}.` : 'Failed to load this section',
    })
  }
  return data
}
