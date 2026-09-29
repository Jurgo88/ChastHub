-- ChastHub: hardening after the Supabase advisors ran on the fresh baseline.
--
-- 1. Pin search_path on the three functions that still resolved names through
--    the caller's search_path (lint 0011).
-- 2. Wrap auth.uid() in a sub-select in RLS policies so Postgres evaluates it
--    once per query instead of once per row (lint 0003). Same rules, faster.

ALTER FUNCTION public.adjust_visitor_time(uuid, numeric, timestamptz, timestamptz) SET search_path = public;
ALTER FUNCTION public.check_rate_limit(text, integer, bigint) SET search_path = public;
ALTER FUNCTION public.update_updated_at() SET search_path = public;

ALTER POLICY "Users can submit reports" ON public.reports
  WITH CHECK (reported_by_id = (SELECT auth.uid()));

ALTER POLICY conversations_insert_participant ON public.conversations
  WITH CHECK (((SELECT auth.uid()) = requested_by) AND (((SELECT auth.uid()) = user_a_id) OR ((SELECT auth.uid()) = user_b_id)));
ALTER POLICY conversations_read_participants ON public.conversations
  USING (((SELECT auth.uid()) = user_a_id) OR ((SELECT auth.uid()) = user_b_id));
ALTER POLICY conversations_update_participants ON public.conversations
  USING (((SELECT auth.uid()) = user_a_id) OR ((SELECT auth.uid()) = user_b_id));

ALTER POLICY dm_messages_insert_own ON public.dm_messages
  WITH CHECK (sender_id = (SELECT auth.uid()));
ALTER POLICY dm_messages_read_participants ON public.dm_messages
  USING ((SELECT auth.uid()) IN (
    SELECT c.user_a_id FROM public.conversations c WHERE c.id = dm_messages.conversation_id
    UNION
    SELECT c.user_b_id FROM public.conversations c WHERE c.id = dm_messages.conversation_id));

ALTER POLICY favorites_delete_own ON public.favorites USING ((SELECT auth.uid()) = user_id);
ALTER POLICY favorites_insert_own ON public.favorites WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY favorites_read_own ON public.favorites USING ((SELECT auth.uid()) = user_id);

ALTER POLICY loq_requests_read ON public.loq_requests
  USING ((loqholder_id = (SELECT auth.uid()))
         OR (loq_id IN (SELECT l.id FROM public.loqs l WHERE l.loqee_id = (SELECT auth.uid()))));

ALTER POLICY loqs_read_participants ON public.loqs
  USING ((loqee_id = (SELECT auth.uid())) OR (loqholder_id = (SELECT auth.uid())));

ALTER POLICY see_own_messages ON public.messages
  USING ((loqee_id = (SELECT auth.uid())) OR (loqholder_id = (SELECT auth.uid())));

ALTER POLICY own_profile_read ON public.profiles USING ((SELECT auth.uid()) = id);
ALTER POLICY own_subscription_read ON public.subscriptions USING (user_id = (SELECT auth.uid()));

ALTER POLICY "users manage own push subscriptions" ON public.push_subscriptions
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY visitor_interactions_read_participants ON public.loq_visitor_interactions
  USING ((loqee_id = (SELECT auth.uid())) OR (loqholder_id = (SELECT auth.uid())));
