# 02 – Pairing System

## Overview

1:1 relationship between a Loqholder and a Loqee.
**Loqee initiates** by sending a request to a Loqholder.
Loqholder accepts or rejects.

---

## Status States

```
pending → active → ended
          ↑
       rejected (back to nothing)
```

- **pending:** Loqee sent request, awaiting Loqholder response
- **active:** Loqholder accepted, loq session can begin
- **ended:** Session terminated (read-only, history preserved)
- **rejected:** Loqholder declined request (loqee can try another)

---

## Pairing Flow

**Step 1 – Loqee sends request:**
1. Loqee browses or searches for a Loqholder by username
2. Clicks "Request Loqholder"
3. System creates relationship: `status = 'pending'`
4. Loqholder receives notification (realtime)
5. Loqee sees: "Request sent, waiting for response..."

**Step 2 – Loqholder responds:**
1. Loqholder sees pending request on dashboard
2. Clicks "Accept" → `status = 'active'`
   OR
   Clicks "Reject" → `status = 'rejected'`, loqee notified
3. On accept: both users see "Pairing active!"

**Step 3 – Loqee creates loq:**
1. Only after pairing is active
2. Loqee creates a loq (see 03_LOQ_SYSTEM.md)
3. Assigns duration
4. Uploads photo of loq combination
5. Loqholder sees the photo (loqee cannot see it again until unloqed)

---

## Ending the Session

- Either user can end the session
- On end:
  1. `relationships.status = 'ended'`
  2. Active loq cleared: `loqs.locked = false`
  3. Both users notified via realtime
- History preserved (read-only)
- After ending: loqee can request a new loqholder

---

## Database

```sql
CREATE TABLE relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loqee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  loqholder_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'active', 'ended', 'rejected')) DEFAULT 'pending',
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT no_self_pairing CHECK (loqholder_id != loqee_id)
);

CREATE INDEX idx_relationships_loqee ON relationships(loqee_id);
CREATE INDEX idx_relationships_loqholder ON relationships(loqholder_id);
```

---

## RLS Policies

```sql
-- Users can see their own relationships
CREATE POLICY "See own relationships"
  ON relationships FOR SELECT
  USING (loqee_id = auth.uid() OR loqholder_id = auth.uid());

-- Only loqee can create (initiate pairing)
CREATE POLICY "Loqee creates"
  ON relationships FOR INSERT
  WITH CHECK (loqee_id = auth.uid());

-- Both can update (accept/reject/end)
CREATE POLICY "Both can update"
  ON relationships FOR UPDATE
  USING (loqee_id = auth.uid() OR loqholder_id = auth.uid());

-- Admin can see all
CREATE POLICY "Admin sees all"
  ON relationships FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
```

---

## Edge Cases

- Loqee already in active relationship → "You already have an active loq session"
- Loqholder already at capacity → show as unavailable in search
- Loqholder rejects → loqee can request someone else immediately
- Request expires after 48 hours if no response → auto-rejected
