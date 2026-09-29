-- Supports pause/resume: records when a loq was paused so remaining time can be recalculated on resume
ALTER TABLE loqs ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;

-- Service role grants for V2 tables (matches pattern from 013_grant_service_role.sql)
GRANT ALL ON public.loqs                     TO service_role;
GRANT ALL ON public.loq_requests             TO service_role;
GRANT ALL ON public.loq_visitor_interactions TO service_role;
