-- Make combination-photos bucket private.
-- Paths (not public URLs) are stored in loqs.combination_photo_url.
-- Server endpoints generate short-lived signed URLs via service role.
UPDATE storage.buckets SET public = false WHERE id = 'combination-photos';
