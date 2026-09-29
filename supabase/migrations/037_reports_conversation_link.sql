-- A report filed from a DM thread had no link back to the conversation it
-- was about — admins could see who reported whom and why, but not the
-- actual messages, making moderation decisions blind. Nullable: reports
-- filed from other contexts (e.g. a future loq-chat report button) don't
-- have one.

ALTER TABLE reports
  ADD COLUMN conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL;

CREATE INDEX idx_reports_conversation ON reports(conversation_id);
