-- TASK-132: signing in with Google never ran /api/auth/complete-oauth, so
-- those accounts got no generated display name, were silently filed as
-- 'loqee', and never saw the 18+ / Terms confirmation.
--
-- The cause is this trigger. handle_new_user() was added in 001 as a safety
-- net "to avoid orphaned auth users", but it makes a profile row exist the
-- instant auth.users gets one — and src/pages/auth/callback.vue decides
-- whether onboarding is needed by asking whether a profile exists. The row
-- the trigger had just written answered "yes", so the callback sent every
-- Google user straight to the dashboard and complete-oauth never ran.
--
-- Email/password signup was unaffected: signup.post.ts upserts over the stub
-- with onConflict: 'id'. complete-oauth.post.ts inserts and guards on 409, so
-- it would have refused even if it had been reached.
--
-- For an OAuth user, an auth.users row with no profile is the correct
-- intermediate state — it is exactly what tells the callback to ask for a
-- role and consent. Neither remaining caller needs the trigger: signup.post.ts
-- upserts and deletes the auth user if the profile write fails, and
-- admin/admins/index.post.ts upserts and does the same.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- ── Backfill the accounts the trigger already created ───────────────────────
-- Same generator and word lists as 053_generated_display_names.sql, which did
-- this once for the accounts that existed then. Anything NULL now was written
-- by the trigger after that migration ran.
--
-- This fixes only the missing name. The role stays as it is — these users may
-- already be running loqs as a loqee, and rewriting it underneath them would
-- break live sessions; it is editable in the profile. The missing Terms/18+
-- consent is deliberately NOT backfilled: recording a consent that was never
-- given is worse than recording none. See the issue for chasing those users.

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
