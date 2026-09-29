-- ChastHub: optional "About you" fields on the profile.
--
-- birth_year rather than a full date of birth: enough to show an age, and the
-- least personal data that does the job. Each field has its own visibility
-- switch; the public profile API only returns a value when its switch is on.
-- Writes go through /api/profile (service role), like every other profile column.

ALTER TABLE public.profiles
  ADD COLUMN birth_year smallint,
  ADD COLUMN gender text,
  ADD COLUMN show_age boolean NOT NULL DEFAULT true,
  ADD COLUMN show_gender boolean NOT NULL DEFAULT true;

-- 18+ platform: the youngest allowed birth year moves with the calendar, so the
-- upper bound is also enforced in the API; this check only rejects nonsense.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_birth_year_check CHECK (birth_year IS NULL OR birth_year BETWEEN 1920 AND 2010),
  ADD CONSTRAINT profiles_gender_check CHECK (gender IS NULL OR gender = ANY (ARRAY['man', 'woman', 'trans', 'non_binary', 'other']));
