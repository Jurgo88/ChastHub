-- TASK-063: visitors get both "+ time" and "− time" buttons (client feedback,
-- "each visitor will have those 2 options to choose from"), using the same
-- loqholder-configured magnitude (loqs.visitor_add_hours) in either direction.

ALTER TABLE loq_visitor_interactions
  ADD COLUMN direction TEXT NOT NULL DEFAULT 'add' CHECK (direction IN ('add', 'remove'));

-- Generalizes add_visitor_time to a signed delta, clamped on both ends:
-- can't push loqed_until before "now" (removal ending the loq early is
-- allowed — that's the intended visitor-driven risk — but not into the
-- past) and can't push it past the existing max-duration ceiling.
CREATE OR REPLACE FUNCTION adjust_visitor_time(
  p_loq_id      UUID,
  p_delta_hours NUMERIC,
  p_min_until   TIMESTAMPTZ,
  p_max_until   TIMESTAMPTZ
) RETURNS TIMESTAMPTZ
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE loqs
  SET loqed_until = GREATEST(
    LEAST(loqed_until + (p_delta_hours || ' hours')::interval, p_max_until),
    p_min_until
  )
  WHERE id = p_loq_id
  RETURNING loqed_until;
$$;
