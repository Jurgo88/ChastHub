-- TASK-057 — limit a loqee to one pending loqholder request at a time.
-- Supersedes the multi-target request model (TASK-026): a loq may have at
-- most one loq_requests row in 'pending' state. If that loqholder declines,
-- the loqee can request someone else.

-- 1. Resolve any pre-existing multi-pending rows so the unique index can be
--    created: keep the most recent pending request per loq, cancel the rest.
UPDATE loq_requests r
SET    status = 'cancelled',
       responded_at = NOW()
WHERE  r.status = 'pending'
  AND  r.id <> (
    SELECT r2.id
    FROM   loq_requests r2
    WHERE  r2.loq_id = r.loq_id
      AND  r2.status = 'pending'
    ORDER BY r2.created_at DESC, r2.id DESC
    LIMIT 1
  );

-- 2. Enforce at most one pending request per loq going forward.
CREATE UNIQUE INDEX IF NOT EXISTS idx_loq_requests_one_pending_per_loq
  ON loq_requests (loq_id)
  WHERE status = 'pending';
