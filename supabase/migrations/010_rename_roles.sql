-- Rename role values from lockee/keyholder to loqee/loqholder
-- Run this in Supabase SQL Editor to apply to the live database

-- 1. Drop constraint first so the UPDATE is not blocked
ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;

-- 2. Migrate any existing rows
UPDATE profiles SET role = 'loqholder' WHERE role = 'keyholder';
UPDATE profiles SET role = 'loqee'     WHERE role = 'lockee';

-- 3. Add new constraint
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['loqee'::text, 'loqholder'::text, 'admin'::text]));

-- 4. Update the fallback trigger default
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'loqee')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
