-- TASK-145: a loq published to find a loqholder was listed in Discover but
-- never given a public_link_id. Only self-loqs get one at creation
-- (api/loqs/index.post.ts), and 061 backfilled the queue that existed at the
-- time — so anything published between that deploy and this one is listed
-- with a NULL link.
--
-- Everything about a listed loq is keyed by that id: the card links to
-- /loq/<public_link_id> and the vote posts to
-- /api/loq/<public_link_id>/adjust-time. Without it the card points at
-- /loq/null and pressing "add time" answers "Loq not found", which is what
-- the client hit while testing.
--
-- Same expression as 061: 32 hex characters, matching generateLinkId(),
-- with no pgcrypto dependency.

UPDATE loqs
SET public_link_id = replace(gen_random_uuid()::TEXT, '-', '')
WHERE listed_in_discover = TRUE
  AND public_link_id IS NULL;
