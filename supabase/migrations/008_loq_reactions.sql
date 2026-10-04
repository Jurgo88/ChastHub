-- Reactions on public lock pages (issue #6). One tap, no text, so nothing to
-- moderate. Written and read only through the API with the service role.

create table if not exists public.loq_reactions (
  id uuid primary key default gen_random_uuid(),
  loq_id uuid not null references public.loqs(id) on delete cascade,
  emoji text not null check (emoji in ('devil', 'lock', 'laugh', 'fire')),
  ip_hash text,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_loq_reactions_loq on public.loq_reactions (loq_id, emoji);
create index if not exists idx_visitor_interactions_loq_created on public.loq_visitor_interactions (loq_id, created_at desc);

alter table public.loq_reactions enable row level security;
