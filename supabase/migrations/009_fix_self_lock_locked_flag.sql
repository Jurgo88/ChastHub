-- Self-locks were inserted with `locked` left at its default (false), so
-- their public page said the lock had ended. The API now derives the flag
-- from the status and new self-locks set it; this fixes existing rows.
update public.loqs
set locked = true
where status in ('active', 'paused') and locked = false;
