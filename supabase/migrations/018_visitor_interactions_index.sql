-- Index for rate-limit query on visitor add-time endpoint
-- Query pattern: WHERE loq_id = $1 AND ip_hash = $2 AND created_at > $3
CREATE INDEX IF NOT EXISTS idx_loq_visitor_interactions_rate_limit
  ON loq_visitor_interactions(loq_id, ip_hash, created_at DESC);
