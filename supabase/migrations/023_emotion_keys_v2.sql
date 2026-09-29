-- Rename emotion keys to match new frontend values
-- Old: happy, anxious, frustrated, pleading, naughty
-- New: excited, chill, weak, nervous, hopeless

ALTER TABLE loqs DROP CONSTRAINT IF EXISTS loqs_emotion_check;

UPDATE loqs SET emotion = 'excited'  WHERE emotion = 'happy';
UPDATE loqs SET emotion = 'chill'    WHERE emotion = 'anxious';
UPDATE loqs SET emotion = 'weak'     WHERE emotion = 'frustrated';
UPDATE loqs SET emotion = 'nervous'  WHERE emotion = 'pleading';
UPDATE loqs SET emotion = 'hopeless' WHERE emotion = 'naughty';

ALTER TABLE loqs
  ADD CONSTRAINT loqs_emotion_check
  CHECK (emotion IN ('excited', 'chill', 'weak', 'nervous', 'hopeless'));
