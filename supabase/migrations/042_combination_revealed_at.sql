-- TASK-084: track whether the loqee has been shown their combination after
-- a loq ends or is cancelled, so /api/loqs/current can surface it exactly
-- once (rather than either never, per the bug being fixed, or forever on
-- every future load).
ALTER TABLE loqs ADD COLUMN combination_revealed_at TIMESTAMPTZ;
