-- TASK-097: a browser's push subscription endpoint is a property of that
-- browser/device, not of whichever app user happens to be logged in when
-- it was created. The old UNIQUE(user_id, endpoint) let the same physical
-- endpoint end up owned by multiple user_id rows (e.g. testing loqee and
-- loqholder accounts on the same device) — sendPushNotification(recipient)
-- would correctly target the recipient's row, but that row's endpoint was
-- the same device the sender was using, making it look like "I get
-- notified for messages I send".
--
-- Dedupe first (keep the most recently created row per endpoint), then
-- make endpoint itself the uniqueness key — subscribing on a device now
-- always reassigns that endpoint to whoever is currently logged in.
DELETE FROM push_subscriptions a
  USING push_subscriptions b
  WHERE a.endpoint = b.endpoint
    AND (a.created_at, a.id) < (b.created_at, b.id);

ALTER TABLE push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_endpoint_key;

ALTER TABLE push_subscriptions
  ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);
