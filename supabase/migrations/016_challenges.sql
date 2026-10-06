-- Shared challenges (issue #12). A challenge is a fixed period or a length from
-- the moment you join; people take part with a running lock and the cron marks
-- each entry completed or failed. Written and read only through the API with
-- the service role.
--
-- Not modelled yet: recurring challenges (the column is there for later).

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 2 and 80),
  description text check (char_length(description) <= 500),
  starts_at timestamptz,
  ends_at timestamptz,
  duration_minutes integer check (duration_minutes between 60 and 525600),
  max_pause_minutes integer not null default 1440 check (max_pause_minutes between 0 and 10080),
  recurring text check (recurring in ('weekly')),
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Exactly one of: a fixed period, or a length from joining.
  constraint challenges_shape check (
    (starts_at is not null and ends_at is not null and ends_at > starts_at and duration_minutes is null)
    or (starts_at is null and ends_at is null and duration_minutes is not null)
  )
);

create table if not exists public.challenge_entries (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  loq_id uuid references public.loqs(id) on delete set null,
  joined_at timestamptz not null default now(),
  completed_at timestamptz,
  failed_at timestamptz,
  primary key (challenge_id, user_id)
);

create index if not exists idx_challenge_entries_open on public.challenge_entries (challenge_id)
  where completed_at is null and failed_at is null;
create index if not exists idx_challenge_entries_user on public.challenge_entries (user_id);

alter table public.challenges enable row level security;
alter table public.challenge_entries enable row level security;
grant all on table public.challenges to service_role;
grant all on table public.challenge_entries to service_role;

-- The two examples from the issue that fit the model. No Nut November runs
-- on UTC calendar days.
insert into public.challenges (slug, title, description, starts_at, ends_at, max_pause_minutes)
values (
  'no-nut-november',
  'No Nut November',
  'Locked for the whole of November. A pause longer than 24 hours counts as the lock being off.',
  '2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z', 1440
) on conflict (slug) do nothing;

insert into public.challenges (slug, title, description, duration_minutes, max_pause_minutes)
values (
  '7-days-of-denial',
  '7 days of denial',
  'Seven days locked, starting whenever you join. A pause longer than 24 hours counts as the lock being off.',
  10080, 1440
) on conflict (slug) do nothing;
