# 03 – Loq System (CORE LOGIC)

## ⚠️ Most critical feature. Read carefully before implementing.

---

## Core Principle

- Loqee creates a loq with a duration
- Loqholder accepts → loq clock starts
- Server stores `loqed_until` in UTC – source of truth
- Client computes countdown locally (no server ticking)
- Loq expires when `NOW() >= loqed_until`

---

## Roles in Loq System

**Loqee can:**
- Create a loq (set duration)
- Upload loq combination photo (loqholder sees, loqee cannot until unloqed)
- Add emotion status (5 emojis) visible to visitors

**Loqholder can:**
- Accept or reject the loq request
- Start, pause, resume, end the loq session
- Add time to the loq clock
- Remove time from the loq clock
- Share public link for visitors to add time

**Visitors (public link) can:**
- View the loq clock countdown
- Add time (loqholder configures: how many hours per interaction)
- See loqee's emotion status

---

## Loq Session States

```
created → accepted → active → paused → ended
                   ↑                  ↑
                rejected          unloqed (time expired)
```

---

## Timezone Handling (CRITICAL)

All timestamps stored in UTC. Client displays in local timezone.

```javascript
// Backend: store UTC
const loqedUntil = new Date(Date.now() + durationMs).toISOString();

// Frontend: display local time
const display = new Date(loq.loqed_until).toLocaleString();

// Countdown: computed in UTC
const msRemaining = new Date(loq.loqed_until) - new Date();
```

---

## Duration Constraints

```
Minimum: 1 minute
Maximum: 7 days
UI options: 15m, 1h, 2h, 4h, 8h, 24h, 3d, 7d + custom
```

---

## Loq Clock (Client Countdown)

```javascript
function startLoqClock(loqedUntil) {
  clearInterval(interval);
  interval = setInterval(() => {
    const ms = new Date(loqedUntil) - new Date();
    if (ms <= 0) {
      countdown.value = 'Unloqed';
      clearInterval(interval);
      syncLoqState();
    } else {
      countdown.value = formatDuration(ms);
    }
  }, 1000);
}
```

---

## Combination Photo

- Loqee uploads photo on loq creation
- Stored in Supabase Storage (private bucket)
- Loqholder can view anytime
- Loqee CANNOT view until loq expires or session ends
- Deleted after session ends (or kept in archive – TBD)

```sql
-- In loqs table:
combination_photo_url TEXT  -- Supabase Storage URL
```

RLS on Storage:
- Loqholder: can read
- Loqee: cannot read while locked = true
- Admin: can read

---

## Emotion Status

- Loqee selects 1 of 5 emojis: 😊 😅 😤 🥺 😈
- Stored in loqs table: `emotion TEXT`
- Displayed on public loq link page
- Can be updated by loqee at any time during session

---

## Public Loq Link (Visitor Interaction)

- Loqholder generates shareable link: `/demo/loq/:public_id`
- No login required to view
- Visitors see:
  - Loq clock countdown
  - Loqee's emotion
  - "Add time" button
- Loqholder configures: hours per visitor interaction (e.g., 1h per click)
- Visitor clicks "Add Time" → loqed_until += configured hours
- Rate limit: 1 vote per IP per hour

---

## Database

```sql
CREATE TABLE loqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  loqed_until TIMESTAMP NOT NULL,
  locked BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT CHECK (status IN ('pending', 'active', 'paused', 'ended')) DEFAULT 'pending',
  set_by_id UUID NOT NULL REFERENCES profiles(id),
  reason TEXT,
  emotion TEXT CHECK (emotion IN ('😊', '😅', '😤', '🥺', '😈')),
  combination_photo_url TEXT,
  public_link_id TEXT UNIQUE,           -- for visitor sharing
  visitor_add_hours NUMERIC DEFAULT 1,  -- hours per visitor interaction
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(relationship_id) WHERE locked = TRUE
);

CREATE INDEX idx_loqs_relationship ON loqs(relationship_id);
CREATE INDEX idx_loqs_public_link ON loqs(public_link_id);
```

---

## RLS Policies

```sql
-- Users in relationship can see loq
CREATE POLICY "See own loqs"
  ON loqs FOR SELECT
  USING (
    relationship_id IN (
      SELECT id FROM relationships
      WHERE loqee_id = auth.uid() OR loqholder_id = auth.uid()
    )
  );

-- Only loqee can create loq
CREATE POLICY "Loqee creates loq"
  ON loqs FOR INSERT
  WITH CHECK (
    set_by_id = auth.uid() AND
    relationship_id IN (
      SELECT id FROM relationships WHERE loqee_id = auth.uid()
    )
  );

-- Only loqholder can update (accept, add/remove time, pause, end)
CREATE POLICY "Loqholder updates loq"
  ON loqs FOR UPDATE
  USING (
    relationship_id IN (
      SELECT id FROM relationships WHERE loqholder_id = auth.uid()
    )
  );

-- Admin can see all
CREATE POLICY "Admin sees all loqs"
  ON loqs FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Public loq read (for visitor page - no auth needed)
CREATE POLICY "Public loq read"
  ON loqs FOR SELECT
  USING (public_link_id IS NOT NULL AND locked = TRUE);
```

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Loq expires while loqee offline | On reconnect: fetch fresh state, recalculate |
| Loqholder adds time | Update loqed_until, broadcast via realtime |
| Loqholder removes time | Update loqed_until (min: 1 minute remaining) |
| Visitor adds time | Public API endpoint, rate limited by IP |
| Session paused | Store pause_time, don't tick countdown |
| Session ended early | locked=false, status='ended' |
| Combination photo access while locked | Block loqee access via RLS/storage policy |
