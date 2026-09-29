-- TASK-168: an inbox for vulnerability reports.
--
-- /security (064) writes security_reports, but the only way to read them was
-- the Supabase table editor, where nothing says which ones have been dealt
-- with. The super-admin page (pages/admin/security.vue) needs a state and a
-- trail: who handled a report, when, and a note on what was done.
--
-- Additive only; the table stays server-only (no policies, service_role
-- grant from 064).

ALTER TABLE public.security_reports
  ADD COLUMN IF NOT EXISTS handled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS handled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_note TEXT;

-- The inbox lists open reports first, newest first.
CREATE INDEX IF NOT EXISTS idx_security_reports_open
  ON public.security_reports (created_at DESC)
  WHERE handled_at IS NULL;
