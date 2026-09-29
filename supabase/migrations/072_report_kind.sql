-- TASK-172: the /security form becomes "Report issue" and takes any issue,
-- so each report says what kind it is. The admin inbox (TASK-173) filters on
-- it and keeps security reports from getting lost among bug reports.
--
-- The table keeps its name: renaming it would touch the RLS lockdown (063),
-- the grants (064) and every query, for no gain.
--
-- DEFAULT 'security' is deliberate: every existing row came from the
-- security-only form, and an old client that sends no kind is that form too.

ALTER TABLE public.security_reports
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'security';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'security_reports_kind_check') THEN
    ALTER TABLE public.security_reports
      ADD CONSTRAINT security_reports_kind_check CHECK (kind IN ('bug', 'security', 'other'));
  END IF;
END $$;
