-- TASK-138: tighten who can read audit_log.
--
-- Numbered 060, not 058. The Supabase CLI keys applied migrations on the
-- filename's leading digits, so a second file starting 058 is treated as
-- already applied and silently skipped. An earlier 058_signup_origin.sql had
-- taken that slot on the live database (it was applied from a branch that
-- never reached main, see #348/#350), which is exactly what happened to this
-- file: it merged, it never ran, and no push would ever have run it. 059 is
-- claimed by the re-landed signup origin migration.
--
-- The `account_deleted` entry now carries the deleted user's real email
-- address (the client asked to keep it, and it cannot stay on auth.users —
-- that column is unique, and leaving it there is exactly what would stop the
-- same person signing up again). The address is deliberately scrubbed from
-- `profiles`, so audit_log is now the one place it survives.
--
-- The existing policy (migration 049) allowed ANY admin to read audit_log via
-- auth_is_admin() — support and analysts included. That was fine when the
-- table held only moderation events; it is not fine now that it holds the
-- addresses of people who asked to be forgotten. /api/admin/deletions is
-- already gated to super_admin, and this makes the table itself agree.
--
-- Safe to tighten: nothing in the app reads audit_log through RLS. Every
-- admin surface goes through a server endpoint on the service-role client,
-- which bypasses policies entirely. Confirmed by grepping the client for
-- 'audit_log' — no hits outside src/server/.

CREATE OR REPLACE FUNCTION auth_is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND is_admin = true
      AND admin_level = 'super_admin'
  )
$$;

DROP POLICY IF EXISTS "Admin reads audit log" ON audit_log;
-- Dropped by its own name too: on any database where this did run under the
-- old number, re-running it must not fail on an existing policy.
DROP POLICY IF EXISTS "Super admin reads audit log" ON audit_log;

CREATE POLICY "Super admin reads audit log"
  ON audit_log FOR SELECT
  USING (auth_is_super_admin());
