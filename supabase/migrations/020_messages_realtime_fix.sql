-- Realtime fix: denormalise participant IDs into messages table
--
-- Root cause: the see_own_messages RLS policy used a subquery
--   loq_id IN (SELECT id FROM loqs WHERE loqee_id = auth.uid() OR loqholder_id = auth.uid())
-- Supabase Realtime evaluates RLS at event-delivery time. Nested subqueries
-- across RLS-protected tables are unreliable in that context, causing the
-- receiving client to silently not get the event even though the row is
-- accessible via the normal REST/PostgREST API.
--
-- Fix: store loqee_id and loqholder_id directly on messages so the policy
-- becomes a simple column equality check, which Realtime evaluates reliably.

-- ── 1. Add participant columns ────────────────────────────────────────────────

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS loqee_id    UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS loqholder_id UUID REFERENCES profiles(id);

-- ── 2. Backfill existing rows from loqs ──────────────────────────────────────

UPDATE messages m
SET
  loqee_id     = l.loqee_id,
  loqholder_id = l.loqholder_id
FROM loqs l
WHERE m.loq_id = l.id
  AND (m.loqee_id IS NULL OR m.loqholder_id IS NULL);

-- ── 3. Index for RLS evaluation ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_messages_loqee_id
  ON messages(loqee_id);
CREATE INDEX IF NOT EXISTS idx_messages_loqholder_id
  ON messages(loqholder_id);

-- ── 4. Replace subquery RLS with direct column check ─────────────────────────

DROP POLICY IF EXISTS "see_own_messages"  ON messages;
DROP POLICY IF EXISTS "send_own_messages" ON messages;
DROP POLICY IF EXISTS "admin_reads_all_messages" ON messages;

-- Direct column check — no subquery, works reliably with Supabase Realtime
CREATE POLICY "see_own_messages" ON messages
  FOR SELECT
  USING (loqee_id = auth.uid() OR loqholder_id = auth.uid());

-- Server inserts via service role (bypasses RLS). This policy only guards
-- direct client-side inserts as a safety net.
CREATE POLICY "send_own_messages" ON messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND (loqee_id = auth.uid() OR loqholder_id = auth.uid())
  );

CREATE POLICY "admin_reads_all_messages" ON messages
  FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
