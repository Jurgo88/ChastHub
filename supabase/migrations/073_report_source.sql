-- TASK-175: reports filed from the account-deletion dialog (TASK-176).
--
-- The admin wants to see why people leave next to what they reported, so a
-- report records where it came from, the deletion reason, and who sent it.
--
--   source         'form' (the public /report page) or 'account_deletion'
--   source_detail  for account_deletion: the reason picked in the dialog
--                  (a DELETION_REASONS value, validated by the API)
--   reporter_id    set only for account_deletion, taken from the session.
--                  The public form stays anonymous, as its copy promises.
--                  The profile becomes an anonymised tombstone right after,
--                  and SET NULL covers a hard delete.
--
-- Additive; existing rows are 'form', which is where they came from.

ALTER TABLE public.security_reports
  ADD COLUMN IF NOT EXISTS source        TEXT NOT NULL DEFAULT 'form',
  ADD COLUMN IF NOT EXISTS source_detail TEXT,
  ADD COLUMN IF NOT EXISTS reporter_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'security_reports_source_check') THEN
    ALTER TABLE public.security_reports
      ADD CONSTRAINT security_reports_source_check CHECK (source IN ('form', 'account_deletion'));
  END IF;
END $$;
