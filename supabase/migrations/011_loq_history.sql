-- Lock history (issue #1): the timeline is built from audit_log rows that carry
-- details->>'loq_id', so look them up by lock instead of scanning the table.

create index if not exists idx_audit_log_loq on public.audit_log ((details->>'loq_id'), created_at);
