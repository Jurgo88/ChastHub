-- Scheduled surprises from the keyholder (issue #11). The settings say how often
-- and how big; the cron plans concrete moments (loq_surprises) a week ahead and
-- executes the due ones. The wearer must never see the planned moments, so both
-- tables are reachable only through the API with the service role.

create table if not exists public.loq_surprise_settings (
  loq_id uuid primary key references public.loqs(id) on delete cascade,
  per_week smallint not null check (per_week between 1 and 14),
  min_minutes integer not null check (min_minutes between 1 and 10080),
  max_minutes integer not null check (max_minutes between 1 and 10080),
  allow_remove boolean not null default false,
  window_start time not null default '08:00',
  window_end time not null default '22:00',
  tz text not null,
  message text check (char_length(message) <= 140),
  created_at timestamptz not null default now(),
  check (min_minutes <= max_minutes)
);

create table if not exists public.loq_surprises (
  id uuid primary key default gen_random_uuid(),
  loq_id uuid not null references public.loqs(id) on delete cascade,
  due_at timestamptz not null,
  delta_minutes integer not null check (delta_minutes <> 0),
  executed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_loq_surprises_due on public.loq_surprises (due_at)
  where executed_at is null and cancelled_at is null;
create index if not exists idx_loq_surprises_loq on public.loq_surprises (loq_id, due_at);

alter table public.loq_surprise_settings enable row level security;
alter table public.loq_surprises enable row level security;
grant all on table public.loq_surprise_settings to service_role;
grant all on table public.loq_surprises to service_role;
