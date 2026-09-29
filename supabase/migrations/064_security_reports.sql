-- Security contact form (po incidente 2026-09-24). Ukladá hlásenia poslané cez
-- /security. Zapisuje doň VÝHRADNE server (service role) cez
-- /api/security/report; klient tabuľku nikdy priamo nečíta ani nezapisuje.
CREATE TABLE IF NOT EXISTS public.security_reports (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message    TEXT        NOT NULL,
  contact    TEXT,
  user_agent TEXT,
  ip         TEXT
);

ALTER TABLE public.security_reports ENABLE ROW LEVEL SECURITY;

-- Žiadne policy pre anon/authenticated: tabuľka je server-only. service_role
-- obchádza RLS, ale grant potrebuje explicitne (viď 013/051). Hlásenia čítaš
-- v Supabase dashboarde (Table editor / SQL) alebo neskôr cez admin API.
REVOKE ALL ON public.security_reports FROM anon, authenticated;
GRANT ALL ON public.security_reports TO service_role;
