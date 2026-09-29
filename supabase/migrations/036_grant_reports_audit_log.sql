-- Fix: reports and audit_log were created in migration 007, before the
-- "grant missing service_role privileges" pass in migration 013 — but 013
-- only covered locks/relationships/profiles/messages/loq_visitor_interactions,
-- missing these two. Confirmed by direct testing: inserting into either table
-- via the service-role client returns 42501 "permission denied for table".
--
-- reports: the failure is visible (POST /api/reports throws 500 "Failed to
-- submit report" — this is what surfaced the bug, via the newly-wired Report
-- button on DM threads).
--
-- audit_log: the failure has been SILENT this whole time — server/utils/
-- auditLog.ts's logAudit() never checks the insert's error/awaits it
-- meaningfully, so every loq_accepted/loq_paused/loq_ended/loq_time_added
-- etc. call has been a silent no-op. Not fixing logAudit() itself here
-- (separate concern, out of scope for this migration) — just restoring the
-- grant so those inserts can actually succeed once it is fixed.

GRANT ALL ON public.reports   TO service_role;
GRANT ALL ON public.audit_log TO service_role;
