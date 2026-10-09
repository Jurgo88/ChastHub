-- Keyholder tasks (issue #3): a task with a deadline, optional proof (text or
-- photo), a reward that takes time off and a penalty that adds it. Written and
-- read only through the API with the service role. Proof photos go to the
-- private verification-photos bucket from migration 018, under <loq_id>/tasks/.

create table if not exists public.loq_tasks (
  id uuid primary key default gen_random_uuid(),
  loq_id uuid not null references public.loqs(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  text text not null check (char_length(text) between 2 and 300),
  due_at timestamptz,
  proof text not null default 'none' check (proof in ('none', 'text', 'photo')),
  reward_minutes integer not null default 0 check (reward_minutes between 0 and 1440),
  penalty_minutes integer not null default 0 check (penalty_minutes between 0 and 4320),
  status text not null default 'open'
    check (status in ('open', 'submitted', 'done', 'failed', 'cancelled')),
  proof_text text check (char_length(proof_text) <= 1000),
  proof_photo_path text,
  submitted_at timestamptz,
  resolved_at timestamptz,
  -- Set when the one-hour reminder went out, so it goes out once.
  reminded_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_loq_tasks_loq on public.loq_tasks (loq_id, status, due_at);
create index if not exists idx_loq_tasks_open on public.loq_tasks (status, due_at) where status in ('open', 'submitted');

alter table public.loq_tasks enable row level security;
grant all on table public.loq_tasks to service_role;

-- A keyholder's own library of tasks to hand out again with one tap.
create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  text text not null check (char_length(text) between 2 and 300),
  proof text not null default 'none' check (proof in ('none', 'text', 'photo')),
  reward_minutes integer not null default 0 check (reward_minutes between 0 and 1440),
  penalty_minutes integer not null default 0 check (penalty_minutes between 0 and 4320),
  created_at timestamptz not null default now()
);

create index if not exists idx_task_templates_owner on public.task_templates (owner_id, created_at desc);

alter table public.task_templates enable row level security;
grant all on table public.task_templates to service_role;
