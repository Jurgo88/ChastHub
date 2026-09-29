-- Run after 002_create_relationships.sql

CREATE TABLE IF NOT EXISTS messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID        NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  sender_id       UUID        NOT NULL REFERENCES profiles(id),
  content         TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 5000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_relationship ON messages(relationship_id, created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Members of the relationship can read its messages
CREATE POLICY "see_own_messages"
  ON messages FOR SELECT
  USING (
    relationship_id IN (
      SELECT id FROM relationships
      WHERE lockee_id = auth.uid() OR keyholder_id = auth.uid()
    )
  );

-- Members can send (server route enforces relationship-active check)
CREATE POLICY "send_own_messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND relationship_id IN (
      SELECT id FROM relationships
      WHERE lockee_id = auth.uid() OR keyholder_id = auth.uid()
    )
  );

-- Admins can read all messages (for moderation)
CREATE POLICY "admin_reads_all_messages"
  ON messages FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- ─── Supabase Realtime setup ─────────────────────────────────────────────────
-- Required for postgres_changes subscriptions with row-level filtering

ALTER TABLE messages      REPLICA IDENTITY FULL;
ALTER TABLE locks         REPLICA IDENTITY FULL;
ALTER TABLE relationships REPLICA IDENTITY FULL;

-- Add tables to the realtime publication (run once per project)
-- If the publication already exists, these are idempotent:
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE locks;
ALTER PUBLICATION supabase_realtime ADD TABLE relationships;
