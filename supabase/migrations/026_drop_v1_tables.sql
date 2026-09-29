-- Drop deprecated V1 tables. Safe to run now that:
-- - All admin endpoints migrated to V2 schema (migrations 015+, PRs #124/#125)
-- - All V1 endpoints return 410
-- - No application code references these tables
DROP TABLE IF EXISTS locks CASCADE;
DROP TABLE IF EXISTS relationships CASCADE;
