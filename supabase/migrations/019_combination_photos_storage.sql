-- Storage bucket for combination photos (loq creation wizard photo mode)
--
-- Bucket is PUBLIC so getPublicUrl() works and the loqholder can display
-- the photo directly in the browser (<img src="...">).
-- Privacy is enforced at the API layer: current.get.ts returns null for
-- combination_photo_url while loq status is active or paused, so the
-- loqee never sees their own photo URL during an active session.
-- The upload path is {user_id}/{timestamp}.{ext} which is non-guessable.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'combination-photos',
  'combination-photos',
  true,
  5242880,    -- 5 MB per file
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- ── INSERT policy ────────────────────────────────────────────────────────────
-- Only authenticated loqees can upload, and only to their own subfolder
-- (path must start with auth.uid()).

CREATE POLICY "loqees_upload_combination_photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'combination-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'loqee'
  );

-- ── DELETE policy ────────────────────────────────────────────────────────────
-- Loqees can delete their own photos (e.g. after cancelling a loq or retrying).

CREATE POLICY "loqees_delete_own_combination_photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'combination-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Admin full-access policy ─────────────────────────────────────────────────
-- Admins can read, upload, update and delete all combination photos.

CREATE POLICY "admins_manage_combination_photos"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'combination-photos'
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    bucket_id = 'combination-photos'
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
