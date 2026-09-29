-- Fix: admin RLS policies used inline subqueries against the profiles table.
-- Supabase Realtime evaluates ALL SELECT policies when checking whether to deliver
-- a WAL event to a subscriber. An inline subquery that hits another RLS-protected
-- table (profiles) is unreliable in that context and silently drops events even
-- for non-admin users whose own policy (e.g. loqs_read_participants) would pass.
--
-- Solution (per Supabase docs): replace the inline subquery with a SECURITY DEFINER
-- function. The function runs with elevated privileges, bypasses RLS on profiles,
-- and is handled as a simple function call rather than a nested subquery by Realtime.

-- ── Helper function ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION auth_is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
$$;

-- ── loqs ──────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "loqs_admin_read"   ON loqs;
DROP POLICY IF EXISTS "loqs_admin_update" ON loqs;

CREATE POLICY "loqs_admin_read" ON loqs
  FOR SELECT USING (auth_is_admin());

CREATE POLICY "loqs_admin_update" ON loqs
  FOR UPDATE USING (auth_is_admin());

-- ── messages ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "admin_reads_all_messages" ON messages;

CREATE POLICY "admin_reads_all_messages" ON messages
  FOR SELECT USING (auth_is_admin());

-- ── loq_requests ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "loq_requests_admin_read" ON loq_requests;

CREATE POLICY "loq_requests_admin_read" ON loq_requests
  FOR SELECT USING (auth_is_admin());
