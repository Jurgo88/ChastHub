# 11 – Demo Loq (Public Page)

## Overview

A public shareable loq page that requires NO login.
Used for marketing launch – loqholders share the link,
visitors can interact with the loq clock.

This is the PRIMARY launch/announcement feature.

---

## Page: `/loq/:public_id`

### What visitors see:
- Loq clock countdown (large, animated)
- Loqee's emotion emoji
- "Add Time" button
- Link to homepage (landing page)
- "Join ChastHub" CTA button

### What visitors can do:
- View the live loq clock
- Click "Add Time" → adds configured hours to the loq
- No login required

---

## How Loqholder shares:
1. During active loq session
2. Clicks "Share Loq Link"
3. System generates `public_link_id` (UUID)
4. Loqholder sets: hours per visitor interaction (default: 1h)
5. Copies link: `chasthub.com/loq/abc123`
6. Shares on social media, Discord, etc.

---

## Demo Loq (for launch marketing)

A special pre-created demo loq that is always active:
- URL: `chasthub.com/demo`
- Not tied to a real user
- Runs continuously
- Resets every 24 hours (or when it hits max duration)
- Shows: fictional loqee emoji + countdown
- Purpose: let non-users experience the concept

---

## Database

```sql
-- public_link_id already in loqs table (see 03_LOQ_SYSTEM.md)
-- visitor_add_hours already in loqs table

-- Track visitor interactions
CREATE TABLE loq_visitor_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loq_id UUID NOT NULL REFERENCES loqs(id) ON DELETE CASCADE,
  visitor_ip TEXT NOT NULL,
  hours_added NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),

  -- Rate limit: 1 interaction per IP per hour per loq
  UNIQUE(loq_id, visitor_ip, date_trunc('hour', created_at))
);
```

---

## API Endpoints

```
GET /api/demo/loq/:public_id
  [Public – no auth]
  Returns: { loqed_until, emotion, visitor_add_hours, locked }

POST /api/demo/loq/:public_id/add-time
  [Public – no auth]
  Rate limited by IP (1 per hour)
  Returns: { new_loqed_until, hours_added }
  Errors: 429 (rate limit), 404 (not found), 410 (loq ended)

GET /api/demo/loq/featured
  [Public – no auth]
  Returns the marketing demo loq
```

---

## RLS Policies

```sql
-- Public loq pages are readable by anyone
CREATE POLICY "Public loq link readable"
  ON loqs FOR SELECT
  USING (public_link_id IS NOT NULL);

-- Visitor interactions insert (no auth needed)
CREATE POLICY "Anyone can add visitor interaction"
  ON loq_visitor_interactions FOR INSERT
  WITH CHECK (true);
```

---

## Edge Cases

- Visitor adds time but loq already ended → 410 "This loq has ended"
- IP rate limit hit → 429 "Come back in an hour to add more time!"
- Public link disabled by loqholder → 404
- Loq clock hits 7-day maximum → no more time can be added
