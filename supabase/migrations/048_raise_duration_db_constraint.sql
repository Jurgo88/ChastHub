-- TASK-098: TASK-085 raised the application-level duration cap to 10 years
-- (loqValidation.ts MAX_DURATION_MINUTES) but missed this DB-level CHECK,
-- which still had the original 7-day bound from the V2 schema (015) —
-- same class of bug as TASK-070's emotion constraint miss. Found in
-- production: creating anything past 7 days hit 23514 on this constraint
-- specifically, distinct from the application-level check that had
-- already been raised and passed.
ALTER TABLE loqs DROP CONSTRAINT IF EXISTS loqs_duration_minutes_check;

ALTER TABLE loqs
  ADD CONSTRAINT loqs_duration_minutes_check
  CHECK (duration_minutes BETWEEN 1 AND 3650 * 24 * 60);
