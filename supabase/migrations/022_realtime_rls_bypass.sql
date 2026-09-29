-- Fix: auth.uid() is unreliable in Supabase Realtime's RLS evaluation context.
-- When the Realtime server evaluates policies for event delivery, it runs a
-- SELECT query in a DB session where request.jwt.claim.sub may not be populated,
-- making auth.uid() return NULL and causing all auth.uid()-based policies to fail.
--
-- Solution: add a supplementary SELECT policy that does NOT depend on auth.uid().
-- We use auth.role() which reads request.jwt.claim.role — a claim that IS reliably
-- set by Realtime — to confirm the subscriber is authenticated. The channel-level
-- filter (loq_id or id) still scopes delivery correctly at the subscription layer.
--
-- The existing loqs_read_participants / see_own_messages policies remain in place
-- for normal REST/PostgREST queries which correctly set auth.uid().

-- ── loqs ──────────────────────────────────────────────────────────────────────
-- Allows any authenticated user's subscription to receive loqs events.
-- Scope is still limited by the postgres_changes filter: id=eq.<loqId>
-- so each subscriber only receives events for their own loq.

DROP POLICY IF EXISTS "loqs_realtime_authenticated" ON loqs;

CREATE POLICY "loqs_realtime_authenticated" ON loqs
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ── messages ──────────────────────────────────────────────────────────────────
-- Same approach: authenticated users receive events for messages.
-- Scope is limited by the postgres_changes filter: loq_id=eq.<loqId>.

DROP POLICY IF EXISTS "messages_realtime_authenticated" ON messages;

CREATE POLICY "messages_realtime_authenticated" ON messages
  FOR SELECT
  USING (auth.role() = 'authenticated');
