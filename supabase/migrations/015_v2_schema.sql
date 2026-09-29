-- V2 Architecture Migration (TASK-021)
-- ⚠️ BREAKING CHANGE: Replaces relationships + locks with loqs + loq_requests
-- Run after 014_leaderboard.sql

-- ============================================================
-- SECTION 1: loqs TABLE
-- ============================================================

CREATE TABLE loqs (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  loqee_id              UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  loqholder_id          UUID        REFERENCES profiles(id),

  status                TEXT        NOT NULL DEFAULT 'draft'
                                    CHECK (status IN ('draft', 'pending', 'active', 'paused', 'ended', 'cancelled')),

  -- Config set by loqee at creation
  duration_minutes      INTEGER     NOT NULL CHECK (duration_minutes BETWEEN 1 AND 10080),
  combination_text      TEXT,
  combination_photo_url TEXT,
  emotion               TEXT        CHECK (emotion IN ('😊', '😅', '😤', '🥺', '😈')),
  reason                TEXT,
  is_public             BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Timer (populated when loqholder accepts)
  loqed_until           TIMESTAMPTZ,
  locked                BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Visitor mode
  public_link_id        TEXT        UNIQUE,
  visitor_add_hours     NUMERIC     NOT NULL DEFAULT 1 CHECK (visitor_add_hours > 0),

  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at           TIMESTAMPTZ,
  ended_at              TIMESTAMPTZ,

  CONSTRAINT combination_required CHECK (
    combination_text IS NOT NULL OR combination_photo_url IS NOT NULL
  ),
  CONSTRAINT no_self_loq CHECK (loqee_id != loqholder_id)
);

-- One active loq per loqee (draft/pending/active/paused all block a new loq)
CREATE UNIQUE INDEX loqs_one_active_per_loqee
  ON loqs(loqee_id)
  WHERE status IN ('draft', 'pending', 'active', 'paused');

CREATE INDEX idx_loqs_loqee      ON loqs(loqee_id);
CREATE INDEX idx_loqs_loqholder  ON loqs(loqholder_id);
CREATE INDEX idx_loqs_status     ON loqs(status);
CREATE INDEX idx_loqs_public_link ON loqs(public_link_id) WHERE public_link_id IS NOT NULL;

ALTER TABLE loqs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECTION 2: loq_requests TABLE
-- ============================================================

CREATE TABLE loq_requests (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  loq_id        UUID        NOT NULL REFERENCES loqs(id) ON DELETE CASCADE,
  loqholder_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'auto_rejected')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at  TIMESTAMPTZ,

  UNIQUE(loq_id, loqholder_id)
);

CREATE INDEX idx_loq_requests_loq       ON loq_requests(loq_id);
CREATE INDEX idx_loq_requests_loqholder ON loq_requests(loqholder_id);
CREATE INDEX idx_loq_requests_pending   ON loq_requests(loqholder_id, status) WHERE status = 'pending';

ALTER TABLE loq_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECTION 3: MIGRATE loq_visitor_interactions TABLE
-- ============================================================
-- Table exists from 008_demo_loq.sql with schema: lock_id, visitor_ip, hours_added
-- Migrate to V2 schema: loq_id, public_link_id, ip_hash, hours_added

-- Drop old index and conflicting policy first
DROP INDEX  IF EXISTS idx_visitor_interactions_lock;
DROP POLICY IF EXISTS "visitor_interactions_insert" ON loq_visitor_interactions;
ALTER TABLE loq_visitor_interactions DROP CONSTRAINT IF EXISTS loq_visitor_interactions_lock_id_fkey;

-- Clear demo interaction data (references old locks, no longer valid)
TRUNCATE loq_visitor_interactions;

-- Remove old columns
ALTER TABLE loq_visitor_interactions
  DROP COLUMN IF EXISTS lock_id,
  DROP COLUMN IF EXISTS visitor_ip;

-- Add new V2 columns
ALTER TABLE loq_visitor_interactions
  ADD COLUMN loq_id        UUID        NOT NULL REFERENCES loqs(id) ON DELETE CASCADE,
  ADD COLUMN public_link_id TEXT        NOT NULL,
  ADD COLUMN ip_hash        TEXT        NOT NULL;

-- Add hours_added check if not already present
ALTER TABLE loq_visitor_interactions
  ADD CONSTRAINT loq_visitor_hours_positive CHECK (hours_added > 0);

CREATE INDEX idx_loq_visitor_loq ON loq_visitor_interactions(loq_id);
CREATE INDEX idx_loq_visitor_ip  ON loq_visitor_interactions(ip_hash, created_at DESC);

ALTER TABLE loq_visitor_interactions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECTION 4: MIGRATE messages TABLE
-- ============================================================

-- Drop policies that reference old relationships table
DROP POLICY IF EXISTS "see_own_messages"  ON messages;
DROP POLICY IF EXISTS "send_own_messages" ON messages;

-- Drop old index and FK before renaming the column
DROP INDEX IF EXISTS idx_messages_relationship;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_relationship_id_fkey;

-- Rename column
ALTER TABLE messages RENAME COLUMN relationship_id TO loq_id;

-- NOT VALID skips checking existing rows that may reference old relationship IDs
ALTER TABLE messages
  ADD CONSTRAINT messages_loq_id_fkey
  FOREIGN KEY (loq_id) REFERENCES loqs(id) ON DELETE CASCADE
  NOT VALID;

CREATE INDEX idx_messages_loq ON messages(loq_id, created_at DESC);

-- Recreate RLS policies using loqs
CREATE POLICY "see_own_messages" ON messages FOR SELECT
  USING (
    loq_id IN (
      SELECT id FROM loqs WHERE loqee_id = auth.uid() OR loqholder_id = auth.uid()
    )
  );

CREATE POLICY "send_own_messages" ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND loq_id IN (
      SELECT id FROM loqs WHERE loqee_id = auth.uid() OR loqholder_id = auth.uid()
    )
  );

-- ============================================================
-- SECTION 5: RLS – loqs
-- ============================================================

-- Loqee reads their own loqs; loqholder reads loqs they control
CREATE POLICY "loqs_read_participants"
  ON loqs FOR SELECT
  USING (loqee_id = auth.uid() OR loqholder_id = auth.uid());

-- Any authenticated user can browse the public queue
CREATE POLICY "loqs_read_public_queue"
  ON loqs FOR SELECT
  USING (is_public = TRUE AND status = 'pending');

-- Loqee creates their own loq (server validates active subscription)
CREATE POLICY "loqs_insert_loqee"
  ON loqs FOR INSERT
  WITH CHECK (loqee_id = auth.uid());

-- Both parties can update (server routes enforce field-level restrictions per role)
CREATE POLICY "loqs_update_participants"
  ON loqs FOR UPDATE
  USING (loqee_id = auth.uid() OR loqholder_id = auth.uid());

CREATE POLICY "loqs_admin_read"
  ON loqs FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "loqs_admin_update"
  ON loqs FOR UPDATE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- ============================================================
-- SECTION 6: RLS – loq_requests
-- ============================================================

-- Loqee sees requests for their loq; loqholder sees requests sent to them
CREATE POLICY "loq_requests_read"
  ON loq_requests FOR SELECT
  USING (
    loqholder_id = auth.uid()
    OR loq_id IN (SELECT id FROM loqs WHERE loqee_id = auth.uid())
  );

-- Loqee initiates via server API
CREATE POLICY "loq_requests_insert"
  ON loq_requests FOR INSERT
  WITH CHECK (
    loq_id IN (SELECT id FROM loqs WHERE loqee_id = auth.uid())
  );

-- Loqholder accepts/rejects; loqee cancels
CREATE POLICY "loq_requests_update"
  ON loq_requests FOR UPDATE
  USING (
    loqholder_id = auth.uid()
    OR loq_id IN (SELECT id FROM loqs WHERE loqee_id = auth.uid())
  );

CREATE POLICY "loq_requests_admin_read"
  ON loq_requests FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- ============================================================
-- SECTION 7: RLS – loq_visitor_interactions
-- ============================================================

-- Loqholder can see interactions for their active loqs
CREATE POLICY "visitor_interactions_read"
  ON loq_visitor_interactions FOR SELECT
  USING (
    loq_id IN (SELECT id FROM loqs WHERE loqholder_id = auth.uid())
  );

-- Public insert (server validates public_link_id, rate limits via ip_hash)
CREATE POLICY "visitor_interactions_insert"
  ON loq_visitor_interactions FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================
-- SECTION 8: UPDATE LEADERBOARD VIEWS
-- ============================================================

DROP VIEW IF EXISTS loqholder_leaderboard;
DROP VIEW IF EXISTS loqee_leaderboard;

-- Loqholder leaderboard: count ended loqs controlled
CREATE OR REPLACE VIEW loqholder_leaderboard AS
SELECT
  p.id,
  COALESCE(p.display_name, split_part(p.email, '@', 1)) AS display_name,
  COUNT(l.id)::INTEGER                                    AS controlled_loqs
FROM profiles p
JOIN loqs l ON l.loqholder_id = p.id
WHERE l.status = 'ended'
  AND p.status = 'active'
  AND p.leaderboard_opt_out = FALSE
GROUP BY p.id, p.display_name, p.email
ORDER BY controlled_loqs DESC
LIMIT 100;

-- Loqee leaderboard: longest single ended loq in hours (accepted_at → loqed_until)
CREATE OR REPLACE VIEW loqee_leaderboard AS
SELECT
  p.id,
  COALESCE(p.display_name, split_part(p.email, '@', 1)) AS display_name,
  ROUND(
    MAX(EXTRACT(EPOCH FROM (l.loqed_until - l.accepted_at)) / 3600)::NUMERIC,
    1
  )                                                       AS longest_loq_hours
FROM profiles p
JOIN loqs l ON l.loqee_id = p.id
WHERE l.status = 'ended'
  AND l.loqed_until IS NOT NULL
  AND l.accepted_at IS NOT NULL
  AND p.status = 'active'
  AND p.leaderboard_opt_out = FALSE
GROUP BY p.id, p.display_name, p.email
ORDER BY longest_loq_hours DESC
LIMIT 100;

GRANT SELECT ON loqholder_leaderboard TO service_role;
GRANT SELECT ON loqee_leaderboard     TO service_role;

-- ============================================================
-- SECTION 9: REALTIME
-- ============================================================

ALTER TABLE loqs                     REPLICA IDENTITY FULL;
ALTER TABLE loq_requests             REPLICA IDENTITY FULL;
ALTER TABLE loq_visitor_interactions REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE loqs;
ALTER PUBLICATION supabase_realtime ADD TABLE loq_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE loq_visitor_interactions;

-- ============================================================
-- SECTION 10: MARK OLD TABLES DEPRECATED
-- ============================================================
-- relationships and locks are kept for historical data only.
-- They are no longer used by the V2 application.
-- After confirming no production data needs migration, run:
--
--   DROP TABLE locks CASCADE;
--   DROP TABLE relationships CASCADE;

COMMENT ON TABLE relationships IS 'DEPRECATED – replaced by loqs + loq_requests (V2, migration 015)';
COMMENT ON TABLE locks IS 'DEPRECATED – replaced by loqs (V2, migration 015)';
