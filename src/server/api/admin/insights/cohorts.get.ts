import { runInsight } from '~/server/utils/insights'

// TASK-188 — retention by signup week. Aggregates only, every admin level.
export default defineEventHandler(event => runInsight(event, 'admin_retention_cohorts', '077'))
