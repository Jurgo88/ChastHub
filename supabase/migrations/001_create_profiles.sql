-- Run in Supabase SQL Editor or via `supabase db push`

CREATE TABLE IF NOT EXISTS profiles (
  id                  UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT        NOT NULL,
  role                TEXT        NOT NULL CHECK (role IN ('loqee', 'loqholder', 'admin')),
  display_name        TEXT,
  avatar_url          TEXT,
  bio                 TEXT,
  subscription_status TEXT        NOT NULL DEFAULT 'inactive' CHECK (subscription_status IN ('inactive', 'active')),
  status              TEXT        NOT NULL DEFAULT 'active'   CHECK (status IN ('active', 'banned')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users read their own profile
CREATE POLICY "own_profile_read"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users update their own profile (non-privileged columns only — enforce via app layer)
CREATE POLICY "own_profile_update"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admins read all profiles
-- Note: recursive lookup is safe here because the admin's own SELECT policy already resolves
CREATE POLICY "admin_read_all_profiles"
  ON profiles FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- ─── Optional: auto-create a minimal profile row on auth.users insert ───────
-- This is a safety net if the server route fails. The server route sets the role;
-- the trigger only creates the row to avoid orphaned auth users.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'loqee')   -- role will be updated by the server route
  ON CONFLICT (id) DO NOTHING;          -- server route already inserted the row
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();
