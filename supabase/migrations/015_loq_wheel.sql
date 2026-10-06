-- Wheel of fortune (issue #4). The wearer spins at set intervals and the result
-- changes the lock. The result is drawn on the server; next_spin_at is how a
-- spin is claimed atomically (UPDATE ... WHERE next_spin_at <= now()), so two
-- quick taps can never both succeed.
-- Written and read only through the API with the service role.

create table if not exists public.loq_wheels (
  loq_id uuid primary key references public.loqs(id) on delete cascade,
  enabled boolean not null default true,
  segments jsonb not null,
  interval_minutes integer not null default 1440 check (interval_minutes between 60 and 10080),
  -- A self-lock wheel is locked after its first spin: from then on it can only get harder.
  locked_config boolean not null default false,
  next_spin_at timestamptz,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.loq_wheel_spins (
  id uuid primary key default gen_random_uuid(),
  loq_id uuid not null references public.loqs(id) on delete cascade,
  spun_by uuid not null references public.profiles(id) on delete cascade,
  segment_index smallint not null,
  -- Copy of the segment at spin time, so later edits do not rewrite history.
  segment jsonb not null,
  applied boolean not null default true,
  delta_minutes integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_loq_wheel_spins_loq on public.loq_wheel_spins (loq_id, created_at desc);

-- While frozen_until is in the future the remaining time is not running down.
-- The freeze itself is done by moving loqed_until back by its length, so Stats
-- and Locktober keep working unchanged; this column is only for display.
alter table public.loqs add column if not exists frozen_until timestamptz;

alter table public.loq_wheels enable row level security;
alter table public.loq_wheel_spins enable row level security;
grant all on table public.loq_wheels to service_role;
grant all on table public.loq_wheel_spins to service_role;
