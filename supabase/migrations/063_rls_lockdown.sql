-- SECURITY INCIDENT RESPONSE — 2026-09-24
--
-- Closes the RLS holes that let any authenticated user read and write the
-- whole database through PostgREST with the public anon key. See
-- SECURITY_AUDIT_2026-09-24.md (findings C1, C2, C3, H1, M5).
--
-- Rotating the Supabase keys alone does NOT fix this: the anon key ships in
-- the client bundle by design, so a rotated key is public again the moment
-- the next build deploys. RLS is the only boundary, and this migration is
-- what restores it.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1 — drop the "realtime bypass" policies  (C1, C2)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 022_realtime_rls_bypass.sql and 038 added `USING (auth.role() =
-- 'authenticated')` to loqs, messages and loq_visitor_interactions, on the
-- premise that auth.uid() was unreliable inside Realtime's policy evaluation
-- and that the postgres_changes channel filter would keep the scope right.
--
-- The channel filter only exists for Realtime. PostgREST evaluates the same
-- policies as the same role with no filter at all, and permissive policies
-- are OR'ed — so this one policy overrode loqs_read_participants and
-- see_own_messages for every REST query. `GET /rest/v1/loqs?select=*` with
-- any user's JWT returned every loq on the platform, combination_text
-- included; the same query on messages returned every loq chat message.
--
-- The premise is also no longer true. loq_requests has only auth.uid()-based
-- SELECT policies and has never had a bypass policy, yet its
-- postgres_changes subscription (dashboard/loqholder.vue:616) works in
-- production. plugins/auth.ts calls realtime.setAuth(access_token), which is
-- what populates the claim. auth.uid() resolves correctly in Realtime today.
--
-- Nothing subscribes to loqs or messages via postgres_changes any more
-- either: composables/useRealtime.ts is the only caller and it is dead code
-- (no component imports it). Loq updates and chat both moved to Broadcast
-- (server/utils/broadcastLoq.ts, components/loq/LoqChat.vue).

DROP POLICY IF EXISTS "loqs_realtime_authenticated"                  ON loqs;
DROP POLICY IF EXISTS "messages_realtime_authenticated"              ON messages;
DROP POLICY IF EXISTS "visitor_interactions_realtime_authenticated"  ON loq_visitor_interactions;

-- loq_visitor_interactions IS still subscribed to via postgres_changes
-- (dashboard/loqee.vue:416 filter loq_id, dashboard/loqholder.vue:636 filter
-- loqholder_id). Both are covered by visitor_interactions_read_participants
-- from 038, which checks loqee_id/loqholder_id against auth.uid().


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 2 — stop clients writing to the database directly  (C3, H1, M5)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Several policies delegated field-level rules to "the app layer":
--
--   own_profile_update      (001) — "non-privileged columns only — enforce via app layer"
--   loqs_update_participants(015) — "server routes enforce field-level restrictions per role"
--
-- Neither had a WITH CHECK or a column list, and nothing forced a client
-- through the app layer. Any user could:
--
--   PATCH /rest/v1/profiles?id=eq.<self>  {"is_admin":true,"admin_level":"super_admin"}
--     -> full platform admin: every DM, ban, revenue
--   PATCH /rest/v1/profiles?id=eq.<self>  {"subscription_status":"active"}
--     -> free subscription, bypassing requireActiveSubscription
--   PATCH /rest/v1/profiles?id=eq.<self>  {"status":"active"}
--     -> self-unban
--   PATCH /rest/v1/loqs?id=eq.<own loq>   {"locked":false,"status":"ended"}
--     -> a loqee unlocks their own loq, bypassing the entire lifecycle
--
-- The fix is not a better policy — it is that the browser has no business
-- writing to these tables at all. Verified against the whole client tree:
-- every $supabase.from() call outside src/server/ is a plain SELECT on
-- profiles (plugins/auth.ts, composables/useAuth.ts, pages/auth/callback.vue,
-- pages/subscription/success.vue). There is not one client-side insert,
-- update, upsert or delete. All writes already go through src/server/api/**
-- with the service role.
--
-- SELECT grants are deliberately left in place: Realtime evaluates RLS as the
-- `authenticated` role and needs them, and the remaining SELECT policies are
-- correctly scoped to auth.uid() once Section 1 has run.

-- profiles: a non-admin was observed reading ALL 562 rows, which the two
-- migration-defined SELECT policies (own_profile_read = own row,
-- admin_read_all_profiles = admin only) cannot explain. The live DB therefore
-- carries a policy that is NOT in these migrations — almost certainly a
-- dashboard-added "Enable read access for all users" template (USING (true)),
-- or RLS was switched off. Rather than guess its name, drop every policy on
-- profiles except the two we want, and force RLS back on. Re-run the pg_policies
-- dump after this migration: only own_profile_read + admin_read_all_profiles
-- should remain.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname NOT IN ('own_profile_read', 'admin_read_all_profiles')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Safety net: recreate the two intended policies if a stray drop ever removed
-- them (idempotent — dropped-and-recreated so the definitions are pinned here).
DROP POLICY IF EXISTS "own_profile_read" ON public.profiles;
CREATE POLICY "own_profile_read" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "admin_read_all_profiles" ON public.profiles;
CREATE POLICY "admin_read_all_profiles" ON public.profiles
  FOR SELECT USING (auth_is_admin());

DROP POLICY IF EXISTS "loqs_update_participants" ON loqs;
DROP POLICY IF EXISTS "loqs_insert_loqee"        ON loqs;
DROP POLICY IF EXISTS "loq_requests_update"      ON loq_requests;
DROP POLICY IF EXISTS "loq_requests_insert"      ON loq_requests;
DROP POLICY IF EXISTS "send_own_messages"        ON messages;

-- M5 — WITH CHECK (TRUE) let anon insert arbitrary rows straight into
-- loq_visitor_interactions, bypassing the public_link_id validation and the
-- per-IP rate limit in loq/[public_id]/adjust-time.post.ts, and (since 038
-- added loqee_id/loqholder_id) forging other people's notifications.
-- adjust-time.post.ts writes with the service role and needs no policy.
DROP POLICY IF EXISTS "visitor_interactions_insert" ON loq_visitor_interactions;

-- Belt and braces: even if a policy is reintroduced by accident, the table
-- privilege is gone. service_role is unaffected — it has explicit GRANT ALL
-- from 013/016/033/035/036/051/057 and bypasses RLS.
REVOKE INSERT, UPDATE, DELETE ON public.profiles                  FROM anon, authenticated;
-- anon must never read profiles directly from the browser: public username
-- pages and search already go through server APIs with the service role.
-- Confirmed live: two dashboard-added "USING (true)" SELECT policies
-- ("Public profile read", "profiles_readable") + this grant let even a
-- logged-OUT visitor read all 562 rows. The policies are dropped by the loop
-- above; revoking the grant is the belt-and-braces.
REVOKE SELECT ON public.profiles FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.loqs                      FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.loq_requests              FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.messages                  FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.loq_visitor_interactions  FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.conversations             FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.dm_messages               FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.favorites                 FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.push_subscriptions        FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions             FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.reports                   FROM anon, authenticated;

-- Financial and audit tables: no client-side read is legitimate either.
REVOKE ALL ON public.payments  FROM anon, authenticated;
REVOKE ALL ON public.audit_log FROM anon, authenticated;

-- waitlist keeps its INSERT grant from 004 — public signup, WITH CHECK (true)
-- is intended there and the table holds nothing but an email address.


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 3 — keep combination_text out of the public queue  (L2)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- loqs_read_public_queue let any authenticated user SELECT * on every public
-- pending loq, combination_text included. The loq is not active yet so the
-- blast radius is smaller than C1, but the column still has no business
-- leaving the server. Scope the policy to rows only; the columns the discover
-- feed actually needs are served by /api/discover/loqs.get.ts with the
-- service role.

DROP POLICY IF EXISTS "loqs_read_public_queue" ON loqs;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 4 — verification
-- ═══════════════════════════════════════════════════════════════════════════
--
-- After applying, confirm no permissive policy grants blanket access:
--
--   SELECT tablename, policyname, cmd, qual
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND qual ILIKE '%auth.role()%';
--   -- expect: 0 rows
--
--   SELECT table_name, privilege_type
--   FROM information_schema.role_table_grants
--   WHERE grantee IN ('anon','authenticated')
--     AND table_schema = 'public'
--   ORDER BY table_name, privilege_type;
--   -- expect: SELECT only, plus INSERT on waitlist
--
-- Then, as a normal (non-admin) user, these must all fail or return nothing
-- beyond that user's own rows:
--
--   GET   /rest/v1/loqs?select=id,combination_text
--   GET   /rest/v1/messages?select=*
--   PATCH /rest/v1/profiles?id=eq.<self>   {"is_admin":true}
