CREATE TABLE IF NOT EXISTS waitlist (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anyone (anon or authenticated) to insert their email
CREATE POLICY "anon_insert_waitlist"
  ON waitlist FOR INSERT
  TO anon
  WITH CHECK (true);

GRANT INSERT ON public.waitlist TO authenticated;

CREATE POLICY "authenticated_insert_waitlist"
  ON waitlist FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only admins can read the list
CREATE POLICY "admin_read_waitlist"
  ON waitlist FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
