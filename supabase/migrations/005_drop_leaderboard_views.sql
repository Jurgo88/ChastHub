-- ChastHub: the Stats page (migration 004) replaced the leaderboard, and
-- nothing reads these views any more. They also ran with their owner's rights
-- and were readable by the anon key, which the security advisor flagged.
DROP VIEW public.loqee_leaderboard;
DROP VIEW public.loqee_leaderboard_all;
DROP VIEW public.loqholder_leaderboard;
DROP VIEW public.loqholder_leaderboard_all;
