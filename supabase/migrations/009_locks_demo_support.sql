-- Run after 008_demo_loq.sql
-- Allows demo loqs that are not tied to a real relationship or user

ALTER TABLE locks
  ALTER COLUMN relationship_id DROP NOT NULL,
  ALTER COLUMN set_by_id       DROP NOT NULL;

ALTER TABLE locks
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure non-demo rows still satisfy the original constraints
ALTER TABLE locks
  ADD CONSTRAINT locks_non_demo_has_relationship
    CHECK (is_demo = TRUE OR relationship_id IS NOT NULL);

ALTER TABLE locks
  ADD CONSTRAINT locks_non_demo_has_set_by
    CHECK (is_demo = TRUE OR set_by_id IS NOT NULL);
