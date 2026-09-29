-- TASK-124: profiles were created with display_name NULL, so every surface
-- fell back to the user's email address — the nav, the profile preview, and
-- (via split_part) the public leaderboard. Publishing the local part of
-- someone's email to strangers is a privacy problem, not a cosmetic one.
--
-- Two halves:
--   1. backfill a generated name onto every profile that has none
--   2. rebuild the leaderboard views so they can never reach for email again
--
-- Word lists mirror src/server/utils/displayName.ts (the runtime generator
-- used for new signups). They are deliberately bland: nothing explicit,
-- nothing that reads as a real first name, nothing that collides with the
-- product's own vocabulary.

DO $$
DECLARE
  adjectives TEXT[] := ARRAY[
    'Amber','Azure','Bold','Brave','Bright','Calm','Clever','Cobalt','Copper',
    'Crimson','Curious','Dusky','Eager','Ember','Fearless','Gentle','Gilded',
    'Golden','Hidden','Indigo','Ivory','Jade','Keen','Lucid','Lunar','Midnight',
    'Mellow','Nimble','Noble','Northern','Onyx','Patient','Quiet','Rapid',
    'Restless','Sable','Scarlet','Silent','Silver','Solar','Steady','Sterling',
    'Stormy','Swift','Teal','Tranquil','Velvet','Violet','Wandering','Wild'
  ];
  nouns TEXT[] := ARRAY[
    'Albatross','Badger','Beacon','Bison','Comet','Condor','Coyote','Crane',
    'Cypress','Dune','Eagle','Ember','Falcon','Fern','Fox','Glacier','Harbor',
    'Hawk','Heron','Ibis','Jaguar','Kestrel','Lantern','Lynx','Magpie','Marten',
    'Meadow','Meteor','Nebula','Ocelot','Orbit','Osprey','Otter','Panther',
    'Petrel','Puma','Quartz','Raven','Ridge','Sparrow','Spruce','Stallion',
    'Summit','Swallow','Thistle','Tundra','Vulture','Willow','Wolf','Wren'
  ];
BEGIN
  -- random() is volatile, so this evaluates per row rather than once.
  UPDATE profiles
  SET display_name =
        adjectives[1 + floor(random() * array_length(adjectives, 1))::INT]
     || nouns[1 + floor(random() * array_length(nouns, 1))::INT]
     || (10 + floor(random() * 90))::INT::TEXT
  WHERE display_name IS NULL
     OR btrim(display_name) = '';
END $$;

-- ── Leaderboard views: no more split_part(email) ────────────────────────────
-- Same definitions as 043_leaderboard_exclude_self_loqs.sql, with the email
-- fallback replaced. Nothing else about them changes here.

CREATE OR REPLACE VIEW loqee_leaderboard AS
SELECT
  p.id,
  COALESCE(p.display_name, 'Loqsy user') AS display_name,
  ROUND(
    MAX(EXTRACT(EPOCH FROM (l.loqed_until - l.created_at)) / 3600)::NUMERIC,
    1
  )                                      AS longest_loq_hours,
  p.avatar_url,
  p.username
FROM profiles p
JOIN loqs l ON l.loqee_id = p.id
WHERE l.status = 'ended'
  AND l.loqed_until IS NOT NULL
  AND l.loqholder_id IS NOT NULL
  AND p.status = 'active'
  AND p.leaderboard_opt_out = FALSE
GROUP BY p.id, p.display_name, p.avatar_url, p.username
ORDER BY longest_loq_hours DESC
LIMIT 100;

CREATE OR REPLACE VIEW loqee_leaderboard_all AS
SELECT
  p.id,
  COALESCE(p.display_name, 'Loqsy user') AS display_name,
  ROUND(
    MAX(EXTRACT(EPOCH FROM (l.loqed_until - l.created_at)) / 3600)::NUMERIC,
    1
  )                                      AS longest_loq_hours,
  p.avatar_url,
  p.username,
  ROW_NUMBER() OVER (
    ORDER BY MAX(EXTRACT(EPOCH FROM (l.loqed_until - l.created_at)) / 3600) DESC
  )::INTEGER                             AS rank
FROM profiles p
JOIN loqs l ON l.loqee_id = p.id
WHERE l.status = 'ended'
  AND l.loqed_until IS NOT NULL
  AND l.loqholder_id IS NOT NULL
  AND p.status = 'active'
  AND p.leaderboard_opt_out = FALSE
GROUP BY p.id, p.display_name, p.avatar_url, p.username;

-- Loqholder views (034 / 040), same treatment.

CREATE OR REPLACE VIEW loqholder_leaderboard AS
SELECT
  p.id,
  COALESCE(p.display_name, 'Loqsy user')                 AS display_name,
  COUNT(l.id)::INTEGER                                   AS controlled_loqs,
  p.avatar_url,
  p.username
FROM profiles p
JOIN loqs l ON l.loqholder_id = p.id
WHERE l.status = 'ended'
  AND p.status = 'active'
  AND p.leaderboard_opt_out = FALSE
GROUP BY p.id, p.display_name, p.avatar_url, p.username
ORDER BY controlled_loqs DESC
LIMIT 100;

CREATE OR REPLACE VIEW loqholder_leaderboard_all AS
SELECT
  p.id,
  COALESCE(p.display_name, 'Loqsy user')                 AS display_name,
  COUNT(l.id)::INTEGER                                   AS controlled_loqs,
  p.avatar_url,
  p.username,
  ROW_NUMBER() OVER (ORDER BY COUNT(l.id) DESC)::INTEGER AS rank
FROM profiles p
JOIN loqs l ON l.loqholder_id = p.id
WHERE l.status = 'ended'
  AND p.status = 'active'
  AND p.leaderboard_opt_out = FALSE
GROUP BY p.id, p.display_name, p.avatar_url, p.username;

GRANT SELECT ON loqee_leaderboard         TO service_role;
GRANT SELECT ON loqee_leaderboard_all     TO service_role;
GRANT SELECT ON loqholder_leaderboard     TO service_role;
GRANT SELECT ON loqholder_leaderboard_all TO service_role;
