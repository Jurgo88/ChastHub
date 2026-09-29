-- TASK-066 (remaining scope): favorites ("heart") + search.
-- Search itself needs no schema change (ILIKE over profiles.username via
-- the service-role client, same pattern as profiles/lookup.get.ts) — only
-- the favorites table is new here.

CREATE TABLE favorites (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  favorited_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT favorites_no_self CHECK (user_id <> favorited_profile_id),
  UNIQUE (user_id, favorited_profile_id)
);

CREATE INDEX idx_favorites_user      ON favorites(user_id);
CREATE INDEX idx_favorites_favorited ON favorites(favorited_profile_id);

GRANT ALL ON public.favorites TO service_role;

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Favorites are private to the user who created them (ticket requirement).
CREATE POLICY "favorites_read_own" ON favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "favorites_insert_own" ON favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "favorites_delete_own" ON favorites
  FOR DELETE USING (auth.uid() = user_id);
