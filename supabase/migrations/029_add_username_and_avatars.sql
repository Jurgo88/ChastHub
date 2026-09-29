-- Username system (TASK-035): fixed-prefix handle at loqsy.app/user/{username}
-- Only the slug is stored; the prefix is UI-only.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

ALTER TABLE profiles ADD CONSTRAINT username_format
  CHECK (username IS NULL OR username ~ '^[a-z][a-z0-9_]{2,19}$');

-- ── Avatars storage bucket ───────────────────────────────────────────────────
-- Same shape as the combination-photos bucket (018/019): public bucket,
-- per-user subfolder, path is {user_id}/{timestamp}.{ext}.
-- Unlike combination photos, any role can upload their own avatar and
-- there's no visibility restriction — avatars are always public.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,    -- 5 MB per file
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "users_upload_own_avatar"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "users_delete_own_avatar"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "admins_manage_avatars"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
