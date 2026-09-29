-- TASK-089: loqholder (or self-loq owner) decides whether visitors on the
-- share link can only add time, only remove time, or both. Defaults to
-- 'both' to match today's existing behaviour for every current loq.
ALTER TABLE loqs
  ADD COLUMN visitor_permission TEXT NOT NULL DEFAULT 'both'
  CHECK (visitor_permission IN ('add', 'remove', 'both'));
