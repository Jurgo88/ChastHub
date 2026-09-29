-- Run after 007_create_reports_audit.sql
-- Adds public loq sharing + visitor interactions

-- ─── Add public link columns to locks table ──────────────────────────────────

ALTER TABLE locks
  ADD COLUMN IF NOT EXISTS public_link_id    TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS visitor_add_hours NUMERIC DEFAULT 1,
  ADD COLUMN IF NOT EXISTS emotion           TEXT CHECK (emotion IN ('😊', '😅', '😤', '🥺', '😈'));

CREATE INDEX IF NOT EXISTS idx_locks_public_link ON locks(public_link_id);

-- Public read: anyone can view a lock that has a public link and is active
CREATE POLICY "public_loq_readable"
  ON locks FOR SELECT
  USING (public_link_id IS NOT NULL AND locked = TRUE);

-- ─── Visitor interactions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS loq_visitor_interactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_id     UUID        NOT NULL REFERENCES locks(id) ON DELETE CASCADE,
  visitor_ip  TEXT        NOT NULL,
  hours_added NUMERIC     NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rate limiting is enforced in API code, not the DB (date_trunc is not IMMUTABLE)
CREATE INDEX idx_visitor_interactions_lock
  ON loq_visitor_interactions (lock_id, visitor_ip, created_at DESC);

ALTER TABLE loq_visitor_interactions ENABLE ROW LEVEL SECURITY;

-- Server uses service role, but allow anon INSERT so RLS doesn't block it
CREATE POLICY "visitor_interactions_insert"
  ON loq_visitor_interactions FOR INSERT
  WITH CHECK (true);

-- ─── Demo loq setup note ─────────────────────────────────────────────────────
-- To activate the /demo page, create a lock row manually (or via admin) and set:
--   public_link_id = 'demo'
--   visitor_add_hours = 1
--   locked = TRUE
--   locked_until = <any future UTC timestamp>
-- The /demo page redirects to /loq/demo which reads this row.
