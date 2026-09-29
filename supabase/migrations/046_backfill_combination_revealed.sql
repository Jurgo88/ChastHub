-- TASK-096: migration 042 added combination_revealed_at as NULL for every
-- existing row, including loqs that had already ended/been cancelled long
-- before this feature existed. /api/loqs/current's fallback treats any
-- ended/cancelled loq with combination_revealed_at IS NULL as "not yet
-- shown" and surfaces the most recent one — so every pre-existing loq
-- resurfaced its combination one at a time, on every dashboard visit,
-- each time the current one got acknowledged. Backfill marks all of them
-- as already revealed so only genuinely new reveals (created after this
-- migration) show up going forward.
UPDATE loqs
SET combination_revealed_at = COALESCE(ended_at, created_at)
WHERE status IN ('ended', 'cancelled')
  AND combination_revealed_at IS NULL;
