-- TASK-142: Discover — one browsable list of loqs anyone signed in can add
-- or remove time on. The interaction itself already exists (TASK-059/089);
-- what was missing is any way to find a loq without being handed its link.
--
-- Three things happen here:
--   1. a loq can be listed in Discover, independently of seeking a loqholder
--   2. a listed loq can refuse time votes outright
--   3. the old loqholder queue is migrated into the new list
--
-- `is_public` keeps its existing meaning — "published, looking for a
-- loqholder to take the key". It is deliberately NOT reused for listing:
-- a self-loq wants to be seen and never wants a loqholder, and a paired loq
-- can want neither. One boolean cannot say both.

ALTER TABLE loqs
  ADD COLUMN IF NOT EXISTS listed_in_discover BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 'none': listed, findable, clock untouchable ─────────────────────────────
-- Until now anyone who published was forced to let strangers move their time;
-- there was no way to say "you can see me, don't touch it".
ALTER TABLE loqs DROP CONSTRAINT IF EXISTS loqs_visitor_permission_check;

ALTER TABLE loqs
  ADD CONSTRAINT loqs_visitor_permission_check
  CHECK (visitor_permission IN ('none', 'add', 'remove', 'both'));

-- ── Who voted: per-account limits, not just per-IP ──────────────────────────
-- One-per-IP-per-hour was proportionate for a link passed between people. A
-- browsable list is a different exposure: mobile data hands you a new IP on
-- demand. Signed-in votes are counted per account; anonymous visitors
-- arriving via a share link keep the IP-hash limit.
ALTER TABLE loq_visitor_interactions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_loq_visitor_interactions_user_rate_limit
  ON loq_visitor_interactions (loq_id, user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loqs_discover
  ON loqs (listed_in_discover, status, created_at DESC)
  WHERE listed_in_discover;

-- ── Migrate the existing queue ──────────────────────────────────────────────
-- Decided with the client (2026-09-23). These loqees published in order to
-- find a loqholder; their name and avatar were already on the queue page, so
-- being listed exposes nothing new. Letting strangers move their clock would,
-- and visitor_permission defaults to 'both' — so they come across as 'none'
-- and turn votes on themselves if they want them.
--
-- They also need a public_link_id: only self-loqs get one at creation
-- (api/loqs/index.post.ts), and both the loq page and the adjust-time
-- endpoint are keyed by it. This expression yields the same 32 hex
-- characters as generateLinkId() without requiring pgcrypto.
UPDATE loqs
SET listed_in_discover = TRUE,
    visitor_permission = 'none',
    public_link_id     = COALESCE(public_link_id, replace(gen_random_uuid()::TEXT, '-', ''))
WHERE is_public = TRUE
  AND status IN ('pending', 'active')
  AND loqholder_id IS NULL;
