-- TASK-164: where each signup came from.
--
-- The referrer and UTM parameters only ever reached Google Analytics, which
-- runs after cookie consent, so anyone who declined cookies arrived from
-- nowhere. These are captured in memory on the client (never in cookies or
-- browser storage) and written once, at signup, beside signup_country
-- (TASK-137).
--
-- Coarse on purpose: the referring *domain* only — never the full URL, whose
-- path and query can carry identifiers — and the three UTM fields that name a
-- campaign. src/server/utils/signupSource.ts sanitises all four; every field
-- is nullable, and NULL is the normal answer for someone who typed the
-- address in.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_referrer     TEXT,
  ADD COLUMN IF NOT EXISTS signup_utm_source   TEXT,
  ADD COLUMN IF NOT EXISTS signup_utm_medium   TEXT,
  ADD COLUMN IF NOT EXISTS signup_utm_campaign TEXT;
