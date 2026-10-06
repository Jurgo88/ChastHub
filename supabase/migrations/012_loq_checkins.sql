-- Daily check-in (issue #8): one mood tap per lock per day, counted by the
-- wearer's own calendar day. Written and read only through the API with the
-- service role.

create table if not exists public.loq_checkins (
  id uuid primary key default gen_random_uuid(),
  loq_id uuid not null references public.loqs(id) on delete cascade,
  mood text not null check (mood in ('calm', 'teased', 'struggling', 'desperate', 'proud')),
  note text check (char_length(note) <= 140),
  local_date date not null,
  created_at timestamptz not null default now(),
  unique (loq_id, local_date)
);

create index if not exists idx_loq_checkins_loq on public.loq_checkins (loq_id, local_date desc);

alter table public.loq_checkins enable row level security;
grant all on table public.loq_checkins to service_role;

-- The keyholder can make the check-in compulsory; a missed day then costs
-- checkin_penalty_minutes. The other columns are bookkeeping for the cron so
-- a reminder or a penalty is only ever applied once per day:
--   checkin_tz              the wearer's time zone, learned from their check-ins
--   checkin_penalty_through last local day already settled (penalised or not)
--   checkin_reminded_on     last local day the evening reminder went out
alter table public.loqs
  add column if not exists checkin_required boolean not null default false,
  add column if not exists checkin_penalty_minutes integer not null default 0
    check (checkin_penalty_minutes between 0 and 4320),
  add column if not exists checkin_tz text,
  add column if not exists checkin_penalty_through date,
  add column if not exists checkin_reminded_on date;
