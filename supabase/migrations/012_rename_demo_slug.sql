-- Rename demo loq public_link_id so the URL doesn't expose it as a demo
UPDATE locks
SET public_link_id = '9kf3mx7p'
WHERE public_link_id = 'demo'
  AND is_demo = TRUE;
