-- Verification photos (issue #2): the keyholder (or a random daily schedule)
-- asks the wearer for a photo that shows a short code, the keyholder approves
-- or rejects it. Written and read only through the API with the service role.

create table if not exists public.loq_verifications (
  id uuid primary key default gen_random_uuid(),
  loq_id uuid not null references public.loqs(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null, -- null = automatic
  code text not null check (code ~ '^[A-Z2-9]{4}$'),
  due_at timestamptz not null,
  penalty_minutes integer not null default 0 check (penalty_minutes between 0 and 10080),
  status text not null default 'pending'
    check (status in ('pending', 'submitted', 'approved', 'rejected', 'expired', 'cancelled')),
  photo_path text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  review_note text check (char_length(review_note) <= 200),
  created_at timestamptz not null default now()
);

create index if not exists idx_loq_verifications_loq on public.loq_verifications (loq_id, created_at desc);
create index if not exists idx_loq_verifications_open on public.loq_verifications (due_at) where status = 'pending';

alter table public.loq_verifications enable row level security;
grant all on table public.loq_verifications to service_role;

-- next_auto_at is the cron bookkeeping: when the next random request is due.
create table if not exists public.loq_verification_settings (
  loq_id uuid primary key references public.loqs(id) on delete cascade,
  random_daily boolean not null default false,
  window_start time not null default '09:00',
  window_end time not null default '21:00',
  tz text not null default 'Europe/Berlin',
  due_minutes integer not null default 120 check (due_minutes between 15 and 1440),
  penalty_minutes integer not null default 0 check (penalty_minutes between 0 and 10080),
  next_auto_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.loq_verification_settings enable row level security;
grant all on table public.loq_verification_settings to service_role;

-- Private bucket, no policies: nobody but the service role can read or list
-- it. The wearer uploads through a signed upload URL the API hands out, the
-- keyholder reads through a signed URL valid for a few minutes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verification-photos', 'verification-photos', false, 3145728, array['image/jpeg'])
on conflict (id) do nothing;
