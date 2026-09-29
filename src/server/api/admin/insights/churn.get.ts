import { runInsight } from '~/server/utils/insights'

// TASK-189 — deletions per reason per week. Reason codes and counts only (no
// email, no note), so every admin level may read it.
export default defineEventHandler(event => runInsight(event, 'admin_churn_reasons', '078'))
