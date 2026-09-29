-- TASK-065: notify the loqee (and loqholder, if paired) in realtime when a
-- visitor adds/removes time, plus let other visitors on the same public
-- page see a live feed.
--
-- The existing visitor_interactions_read policy only let the LOQHOLDER read
-- rows, via a subquery on loqs (`loq_id IN (SELECT id FROM loqs WHERE
-- loqholder_id = auth.uid())`). Two problems for postgres_changes delivery:
--   1. The loqee couldn't read their own loq's interactions at all.
--   2. Subqueries against another RLS-protected table are exactly the
--      pattern that broke Realtime delivery for `messages` (migrations
--      020-022) — Realtime evaluates SELECT policies at event-delivery
--      time, and a nested subquery into a second RLS table is unreliable
--      there even though it works fine for a normal REST query.
-- Same fix as messages got: denormalize the participant ids onto the row
-- and use direct column equality.

ALTER TABLE loq_visitor_interactions
  ADD COLUMN loqee_id UUID REFERENCES profiles(id),
  ADD COLUMN loqholder_id UUID REFERENCES profiles(id);

UPDATE loq_visitor_interactions vi
SET loqee_id = l.loqee_id, loqholder_id = l.loqholder_id
FROM loqs l
WHERE l.id = vi.loq_id;

CREATE INDEX idx_loq_visitor_loqee     ON loq_visitor_interactions(loqee_id);
CREATE INDEX idx_loq_visitor_loqholder ON loq_visitor_interactions(loqholder_id);

DROP POLICY IF EXISTS "visitor_interactions_read" ON loq_visitor_interactions;

CREATE POLICY "visitor_interactions_read_participants" ON loq_visitor_interactions
  FOR SELECT USING (loqee_id = auth.uid() OR loqholder_id = auth.uid());

-- Same permissive fallback messages needed (022_realtime_rls_bypass.sql) —
-- auth.uid() itself was found unreliable during Realtime's own policy
-- evaluation, scoping is left to the channel filter instead.
CREATE POLICY "visitor_interactions_realtime_authenticated" ON loq_visitor_interactions
  FOR SELECT USING (auth.role() = 'authenticated');
