import { runInsight } from '~/server/utils/insights'

// TASK-187 — subscriptions over time and the past-due list. super_admin only,
// like Revenue: amounts, and people named with their email.
export default defineEventHandler(event => runInsight(event, 'admin_subscription_trends', '001', ['super_admin']))
