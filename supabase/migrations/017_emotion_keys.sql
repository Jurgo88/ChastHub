-- Replace emoji values in loqs.emotion with readable text keys
-- Frontend maps: happy=😊  anxious=😅  frustrated=😤  pleading=🥺  naughty=😈

ALTER TABLE loqs DROP CONSTRAINT IF EXISTS loqs_emotion_check;

ALTER TABLE loqs
  ADD CONSTRAINT loqs_emotion_check
  CHECK (emotion IN ('happy', 'anxious', 'frustrated', 'pleading', 'naughty'));

-- Also update locks.emotion for consistency (V1 table, kept for history)
ALTER TABLE locks DROP CONSTRAINT IF EXISTS locks_emotion_check;
