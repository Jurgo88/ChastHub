import { runInsight } from '~/server/utils/insights'

// TASK-186 — how long loqs wait for a loqholder, and the loqee:loqholder
// balance. Aggregates only, so every admin level may read it.
export default defineEventHandler(event => runInsight(event, 'admin_marketplace', '075'))
