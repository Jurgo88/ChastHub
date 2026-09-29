-- Run after 001_create_profiles.sql

CREATE TABLE IF NOT EXISTS relationships (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  keyholder_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- NULL until the lockee enters the invite code
  lockee_id         UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'active', 'ended')),
  invite_code       TEXT        UNIQUE NOT NULL,
  invite_expires_at TIMESTAMPTZ NOT NULL,
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT no_self_pairing CHECK (keyholder_id != lockee_id)
);

-- Prevent a keyholder from having more than one active relationship
CREATE UNIQUE INDEX one_active_per_keyholder
  ON relationships(keyholder_id)
  WHERE status = 'active';

-- Prevent a lockee from having more than one active relationship
CREATE UNIQUE INDEX one_active_per_lockee
  ON relationships(lockee_id)
  WHERE status = 'active' AND lockee_id IS NOT NULL;

CREATE INDEX idx_relationships_keyholder  ON relationships(keyholder_id);
CREATE INDEX idx_relationships_lockee     ON relationships(lockee_id);
CREATE INDEX idx_relationships_invite     ON relationships(invite_code);

ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;

-- Users see relationships they are part of
CREATE POLICY "see_own_relationships"
  ON relationships FOR SELECT
  USING (lockee_id = auth.uid() OR keyholder_id = auth.uid());

-- Only keyholders can create (insert)
CREATE POLICY "keyholder_creates"
  ON relationships FOR INSERT
  WITH CHECK (keyholder_id = auth.uid());

-- Only keyholders can update (confirm, end); lockee join goes through service-role API
CREATE POLICY "keyholder_updates"
  ON relationships FOR UPDATE
  USING (keyholder_id = auth.uid());

-- Admins can read all relationships
CREATE POLICY "admin_sees_all"
  ON relationships FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
