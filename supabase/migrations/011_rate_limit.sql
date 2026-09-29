CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key        TEXT        NOT NULL,
  count      INTEGER     NOT NULL DEFAULT 1,
  reset_at   TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (key)
);

ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.rate_limit_buckets TO service_role;

CREATE INDEX IF NOT EXISTS idx_rate_limit_reset ON rate_limit_buckets(reset_at);

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key        TEXT,
  p_max        INTEGER,
  p_window_ms  BIGINT
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_now      TIMESTAMPTZ := NOW();
  v_reset_at TIMESTAMPTZ;
  v_count    INTEGER;
BEGIN
  SELECT count, reset_at INTO v_count, v_reset_at
  FROM rate_limit_buckets WHERE key = p_key;

  IF NOT FOUND OR v_reset_at <= v_now THEN
    INSERT INTO rate_limit_buckets(key, count, reset_at)
    VALUES (p_key, 1, v_now + (p_window_ms || ' milliseconds')::INTERVAL)
    ON CONFLICT (key) DO UPDATE
      SET count = 1, reset_at = v_now + (p_window_ms || ' milliseconds')::INTERVAL;
    RETURN TRUE;
  END IF;

  IF v_count >= p_max THEN
    RETURN FALSE;
  END IF;

  UPDATE rate_limit_buckets SET count = count + 1 WHERE key = p_key;
  RETURN TRUE;
END;
$$;
