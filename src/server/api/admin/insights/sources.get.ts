import { runInsight } from '~/server/utils/insights'

// TASK-185 — per source: signups, used a loq, ever paid, paying now.
// Aggregates only, so every admin level may read it.
export default defineEventHandler(event => runInsight(event, 'admin_source_quality', '001'))
