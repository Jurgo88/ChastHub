-- TASK-094: separate admin status from product role.
-- `profiles.role` conflated a user's product identity (loqee/loqholder) with
-- admin status ('admin'), so promoting someone to admin overwrote their real
-- role. Admin status now lives in its own `is_admin` flag + `admin_level`
-- tier, and `role` is left untouched. The `'admin'` value stays in the
-- existing `role` CHECK constraint as an unused legacy allowance — no rows
-- use it, removing it buys nothing and risks nothing by leaving it.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_level TEXT
  CHECK (admin_level IN ('super_admin', 'support', 'analyst'));

-- ── Shared admin-check function (used by Realtime-sensitive policies) ────────
-- See 021_realtime_admin_policy_fix.sql for why this must stay a SECURITY
-- DEFINER function rather than an inline subquery.

CREATE OR REPLACE FUNCTION auth_is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_admin = true
  )
$$;

-- ── profiles ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "admin_read_all_profiles" ON profiles;
CREATE POLICY "admin_read_all_profiles"
  ON profiles FOR SELECT
  USING (auth_is_admin());

-- ── waitlist ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "admin_read_waitlist" ON waitlist;
CREATE POLICY "admin_read_waitlist"
  ON waitlist FOR SELECT
  USING (auth_is_admin());

-- ── reports / audit_log ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admin reads reports" ON reports;
CREATE POLICY "Admin reads reports"
  ON reports FOR SELECT
  USING (auth_is_admin());

DROP POLICY IF EXISTS "Admin updates reports" ON reports;
CREATE POLICY "Admin updates reports"
  ON reports FOR UPDATE
  USING (auth_is_admin());

DROP POLICY IF EXISTS "Admin reads audit log" ON audit_log;
CREATE POLICY "Admin reads audit log"
  ON audit_log FOR SELECT
  USING (auth_is_admin());

-- ── subscriptions ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "admin_reads_all_subscriptions" ON subscriptions;
CREATE POLICY "admin_reads_all_subscriptions"
  ON subscriptions FOR SELECT
  USING (auth_is_admin());

-- ── storage: combination-photos / avatars ────────────────────────────────────

DROP POLICY IF EXISTS "admins_manage_combination_photos" ON storage.objects;
CREATE POLICY "admins_manage_combination_photos"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'combination-photos' AND auth_is_admin())
  WITH CHECK (bucket_id = 'combination-photos' AND auth_is_admin());

DROP POLICY IF EXISTS "admins_manage_avatars" ON storage.objects;
CREATE POLICY "admins_manage_avatars"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'avatars' AND auth_is_admin())
  WITH CHECK (bucket_id = 'avatars' AND auth_is_admin());
