-- TASK-070: client answered the open question directly — "can't they just
-- type an emoji, as a custom button?" — confirming free-form emoji instead
-- of an expanded fixed preset list.
--
-- Converts the existing key-based values to their emoji equivalents first
-- (same pattern as 017/023, which did this exact kind of conversion when
-- the key set changed), so there's no special-casing old rows anywhere in
-- app code afterward — loqs.emotion always holds the emoji itself now.
--
-- The old CHECK constraint must be dropped BEFORE these UPDATEs, not
-- after — the old constraint only allows the 5 key values, so writing an
-- emoji into the column while it's still active fails with 23514. (Learned
-- this the hard way: got the order backwards here despite 023 below doing
-- it correctly — drop-update-add, not update-drop-add.)
ALTER TABLE loqs DROP CONSTRAINT IF EXISTS loqs_emotion_check;

UPDATE loqs SET emotion = '🤭' WHERE emotion = 'excited';
UPDATE loqs SET emotion = '😅' WHERE emotion = 'chill';
UPDATE loqs SET emotion = '😵' WHERE emotion = 'weak';
UPDATE loqs SET emotion = '🥺' WHERE emotion = 'nervous';
UPDATE loqs SET emotion = '😭' WHERE emotion = 'hopeless';

-- No longer a fixed enum — just a sanity bound. char_length() counts
-- Unicode code points, and even a heavily-modified emoji (skin tone +
-- ZWJ family sequence, e.g. 👨‍👩‍👧‍👦) stays well under 16.
ALTER TABLE loqs
  ADD CONSTRAINT loqs_emotion_check
  CHECK (emotion IS NULL OR char_length(emotion) BETWEEN 1 AND 16);
