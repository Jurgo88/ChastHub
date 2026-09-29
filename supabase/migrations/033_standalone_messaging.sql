-- TASK-067: standalone direct messaging, independent of any loq.
--
-- "conversations" is the message-request gate: the first message between two
-- users creates a pending row (requested_by = sender). The recipient opens
-- the thread either by replying (implicit accept, enforced in the API layer)
-- or via an explicit accept/decline action. One row per unordered pair,
-- enforced by always storing the lower profile id in user_a_id.
--
-- Writes go through the service-role client only (same pattern as loqs/
-- messages) — RLS below is a safety net, not the primary enforcement point.
-- Realtime uses Broadcast (client re-broadcasts its own send, both sides
-- dedupe by id), not postgres_changes, so none of the denormalization/
-- SECURITY DEFINER workarounds migrations 020-022 needed for `messages`
-- apply here.

CREATE TABLE conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status          TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
  requested_by    UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at    TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,

  CONSTRAINT conversations_distinct_users CHECK (user_a_id <> user_b_id),
  CONSTRAINT conversations_ordered_pair   CHECK (user_a_id < user_b_id),
  CONSTRAINT conversations_requester_is_participant CHECK (requested_by IN (user_a_id, user_b_id)),
  UNIQUE (user_a_id, user_b_id)
);

CREATE INDEX idx_conversations_user_a ON conversations(user_a_id);
CREATE INDEX idx_conversations_user_b ON conversations(user_b_id);

CREATE TABLE dm_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES profiles(id),
  content         TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 5000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dm_messages_conversation ON dm_messages(conversation_id, created_at DESC);

GRANT ALL ON public.conversations TO service_role;
GRANT ALL ON public.dm_messages   TO service_role;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_messages   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_read_participants" ON conversations
  FOR SELECT USING (auth.uid() IN (user_a_id, user_b_id));

CREATE POLICY "conversations_insert_participant" ON conversations
  FOR INSERT WITH CHECK (auth.uid() = requested_by AND auth.uid() IN (user_a_id, user_b_id));

CREATE POLICY "conversations_update_participants" ON conversations
  FOR UPDATE USING (auth.uid() IN (user_a_id, user_b_id));

CREATE POLICY "conversations_admin_read" ON conversations
  FOR SELECT USING (auth_is_admin());

CREATE POLICY "dm_messages_read_participants" ON dm_messages
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_a_id FROM conversations WHERE id = conversation_id
      UNION
      SELECT user_b_id FROM conversations WHERE id = conversation_id
    )
  );

CREATE POLICY "dm_messages_insert_own" ON dm_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "dm_messages_admin_read" ON dm_messages
  FOR SELECT USING (auth_is_admin());
