-- Grant missing table-level privileges to service_role.
-- service_role bypasses RLS but still needs explicit GRANT if the table
-- was created without one (migrations 003–009 were missing these).

GRANT ALL ON public.locks                   TO service_role;
GRANT ALL ON public.relationships           TO service_role;
GRANT ALL ON public.profiles                TO service_role;
GRANT ALL ON public.messages                TO service_role;
GRANT ALL ON public.loq_visitor_interactions TO service_role;
