-- Messages redesign: per-participant read state, read receipts and an inbox
-- query that returns last message and unread count in one round trip.

alter table public.conversations
  add column if not exists user_a_last_read_at timestamptz,
  add column if not exists user_b_last_read_at timestamptz;

-- Existing threads start as read, so nobody opens the new inbox to a wall of
-- old "unread" conversations.
update public.conversations
set user_a_last_read_at = coalesce(user_a_last_read_at, now()),
    user_b_last_read_at = coalesce(user_b_last_read_at, now());

alter table public.profiles
  add column if not exists show_read_receipts boolean not null default true;

-- Every conversation of p_user with the other participant id, the latest
-- message and how many messages from the other side arrived after p_user
-- last read the thread.
create or replace function public.dm_inbox(p_user uuid)
returns table (
  id uuid,
  status text,
  requested_by uuid,
  created_at timestamptz,
  responded_at timestamptz,
  last_message_at timestamptz,
  other_id uuid,
  my_last_read_at timestamptz,
  other_last_read_at timestamptz,
  last_content text,
  last_sender uuid,
  unread integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.status, c.requested_by, c.created_at, c.responded_at, c.last_message_at,
    case when c.user_a_id = p_user then c.user_b_id else c.user_a_id end,
    case when c.user_a_id = p_user then c.user_a_last_read_at else c.user_b_last_read_at end,
    case when c.user_a_id = p_user then c.user_b_last_read_at else c.user_a_last_read_at end,
    lm.content,
    lm.sender_id,
    (
      select count(*)::int
      from public.dm_messages m
      where m.conversation_id = c.id
        and m.sender_id <> p_user
        and m.created_at > coalesce(
          case when c.user_a_id = p_user then c.user_a_last_read_at else c.user_b_last_read_at end,
          '-infinity'::timestamptz)
    )
  from public.conversations c
  left join lateral (
    select m.content, m.sender_id
    from public.dm_messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  where (c.user_a_id = p_user or c.user_b_id = p_user)
    and c.status <> 'declined'
  order by c.last_message_at desc nulls last, c.created_at desc
$$;

-- Number of conversations with something new for p_user: incoming requests
-- and accepted threads with unread messages. Feeds the badge in the nav.
create or replace function public.dm_unread_total(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.conversations c
  where (c.user_a_id = p_user or c.user_b_id = p_user)
    and (c.status = 'accepted' or (c.status = 'pending' and c.requested_by <> p_user))
    and exists (
      select 1 from public.dm_messages m
      where m.conversation_id = c.id
        and m.sender_id <> p_user
        and m.created_at > coalesce(
          case when c.user_a_id = p_user then c.user_a_last_read_at else c.user_b_last_read_at end,
          '-infinity'::timestamptz)
    )
$$;

revoke all on function public.dm_inbox(uuid) from public, anon, authenticated;
revoke all on function public.dm_unread_total(uuid) from public, anon, authenticated;
grant execute on function public.dm_inbox(uuid) to service_role;
grant execute on function public.dm_unread_total(uuid) to service_role;
