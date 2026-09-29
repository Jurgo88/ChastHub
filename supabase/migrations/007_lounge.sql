-- Locktober Lounge: one shared text room, open in scheduled sessions during
-- October. Everything goes through the API with the service role, so the
-- tables have RLS on and no policies.

create table if not exists public.lounge_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default false,
  starts_on date not null default date '2026-10-01',
  ends_on date not null default date '2026-10-31',
  -- Wall-clock windows in a named time zone, so daylight saving is handled.
  -- "24:00" means midnight at the end of that day.
  sessions jsonb not null default '[
    {"name": "Europe", "tz": "Europe/Berlin", "start": "19:00", "end": "23:00"},
    {"name": "Americas", "tz": "America/New_York", "start": "20:00", "end": "24:00"}
  ]'::jsonb,
  slow_mode_seconds integer not null default 10 check (slow_mode_seconds between 0 and 600),
  min_account_age_hours integer not null default 24 check (min_account_age_hours between 0 and 720),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.lounge_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.lounge_questions (
  day smallint primary key check (day between 1 and 31),
  text text not null check (char_length(text) between 3 and 200)
);

create table if not exists public.lounge_messages (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'user' check (kind in ('user', 'system')),
  user_id uuid references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  reply_to uuid references public.lounge_messages(id) on delete set null,
  question_day smallint check (question_day between 1 and 31),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  constraint lounge_messages_author check ((kind = 'user') = (user_id is not null))
);

create index if not exists idx_lounge_messages_created on public.lounge_messages (created_at desc);
create index if not exists idx_lounge_messages_user on public.lounge_messages (user_id, created_at desc);

create table if not exists public.lounge_mutes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  muted_until timestamptz not null,
  muted_by uuid references public.profiles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

-- "Remind me": one push when the next session opens.
create table if not exists public.lounge_reminders (
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_start timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, session_start)
);

-- Sessions the scheduled tick has already opened (announcement + reminders).
create table if not exists public.lounge_session_log (
  session_start timestamptz primary key,
  name text not null,
  opened_at timestamptz not null default now()
);

alter table public.reports
  add column if not exists lounge_message_id uuid references public.lounge_messages(id) on delete set null;

alter table public.lounge_settings enable row level security;
alter table public.lounge_questions enable row level security;
alter table public.lounge_messages enable row level security;
alter table public.lounge_mutes enable row level security;
alter table public.lounge_reminders enable row level security;
alter table public.lounge_session_log enable row level security;

insert into public.lounge_questions (day, text) values
  (1, 'Day 1. Why are you doing Locktober this year?'),
  (2, 'How did the first night go?'),
  (3, 'What is one thing you already miss?'),
  (4, 'Who knows you are locked right now? Your keyholder, a partner, nobody?'),
  (5, 'What was the hardest moment today?'),
  (6, 'Best tip for sleeping well while locked?'),
  (7, 'One week in. What surprised you the most so far?'),
  (8, 'Keyholders: what is your favourite way to keep a wearer on their toes?'),
  (9, 'Wearers: what rule from your keyholder do you secretly like?'),
  (10, 'Day 10. Rate your week from 1 to 10 and tell us why.'),
  (11, 'What do you do when the urge gets strong?'),
  (12, 'How do you handle cleaning and hygiene with your setup?'),
  (13, 'What would make you ask for an early release? Would you actually ask?'),
  (14, 'Two weeks. Are you more calm or more restless than on day 1?'),
  (15, 'Halfway there. What is your goal for the second half?'),
  (16, 'Has anyone added time to your lock this month? How did it feel?'),
  (17, 'What is the most creative task a keyholder has given you?'),
  (18, 'Which device are you wearing, and would you recommend it?'),
  (19, 'What changed in how you think about control since October 1?'),
  (20, 'Day 20. Share one small win from today.'),
  (21, 'Three weeks. What keeps you going now?'),
  (22, 'Keyholders: how do you decide when to reward and when to tease?'),
  (23, 'What is the funniest close call you have had this month?'),
  (24, 'If Locktober was 60 days long, would you still be in?'),
  (25, 'What advice would you give someone starting their first Locktober?'),
  (26, 'What is harder: the days or the nights?'),
  (27, 'How has your relationship with your keyholder or partner changed this month?'),
  (28, 'Four weeks. What are you most proud of?'),
  (29, 'What will you do first when the lock comes off? Or will it stay on?'),
  (30, 'One more day. Who in this lounge helped you get here?'),
  (31, 'Day 31. You made it. What did Locktober teach you?')
on conflict (day) do nothing;
