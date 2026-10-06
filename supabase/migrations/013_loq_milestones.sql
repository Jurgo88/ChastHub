-- Milestones during a lock (issue #7). One row per lock and milestone, written
-- once by the cron; seen_at is set when the wearer dismisses the card.
-- Written and read only through the API with the service role.

create table if not exists public.loq_milestones (
  loq_id uuid not null references public.loqs(id) on delete cascade,
  key text not null check (key in ('24h', '3d', '7d', 'half', 'last_day', '14d', '30d')),
  reached_at timestamptz not null default now(),
  seen_at timestamptz,
  primary key (loq_id, key)
);

alter table public.loq_milestones enable row level security;
grant all on table public.loq_milestones to service_role;
