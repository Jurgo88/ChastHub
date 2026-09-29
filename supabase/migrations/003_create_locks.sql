-- Run after 002_create_relationships.sql

CREATE TABLE IF NOT EXISTS locks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID        NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  set_by_id       UUID        NOT NULL REFERENCES profiles(id),
  locked_until    TIMESTAMPTZ NOT NULL,      -- UTC, always the source of truth
  locked          BOOLEAN     NOT NULL DEFAULT TRUE,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce: only one active lock per relationship at any time
CREATE UNIQUE INDEX one_active_lock_per_relationship
  ON locks(relationship_id)
  WHERE locked = TRUE;

CREATE INDEX idx_locks_relationship ON locks(relationship_id);
CREATE INDEX idx_locks_locked_until ON locks(locked_until);

ALTER TABLE locks ENABLE ROW LEVEL SECURITY;

-- Members of the relationship can see its locks
CREATE POLICY "see_own_locks"
  ON locks FOR SELECT
  USING (
    relationship_id IN (
      SELECT id FROM relationships
      WHERE lockee_id = auth.uid() OR keyholder_id = auth.uid()
    )
  );

-- Only keyholder can insert (via service-role API route which enforces this)
CREATE POLICY "keyholder_sets_lock"
  ON locks FOR INSERT
  WITH CHECK (
    set_by_id = auth.uid()
    AND relationship_id IN (
      SELECT id FROM relationships WHERE keyholder_id = auth.uid()
    )
  );

-- Only keyholder can update (deactivate lock)
CREATE POLICY "keyholder_deactivates_lock"
  ON locks FOR UPDATE
  USING (
    relationship_id IN (
      SELECT id FROM relationships WHERE keyholder_id = auth.uid()
    )
  );

-- Admins see everything
CREATE POLICY "admin_sees_all_locks"
  ON locks FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- ─── Auto-update updated_at on row changes ──────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER locks_updated_at
  BEFORE UPDATE ON locks
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();
