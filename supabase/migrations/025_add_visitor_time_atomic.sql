-- Atomic visitor add-time update.
-- Prevents race condition where two concurrent visitors both read the same
-- loqed_until, compute the new value independently, and the last write wins.
CREATE OR REPLACE FUNCTION add_visitor_time(
  p_loq_id    UUID,
  p_hours     NUMERIC,
  p_max_until TIMESTAMPTZ
) RETURNS TIMESTAMPTZ
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE loqs
  SET loqed_until = LEAST(
    loqed_until + (p_hours || ' hours')::interval,
    p_max_until
  )
  WHERE id = p_loq_id
  RETURNING loqed_until;
$$;
