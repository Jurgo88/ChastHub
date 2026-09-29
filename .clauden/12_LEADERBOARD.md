# 12 – Leaderboard

## Overview

Public leaderboard showing top users.
Usernames are displayed (no private info).

---

## Two Leaderboards

### Loqholders Leaderboard
- Metric: "Controlled Loqs" = total number of completed loq sessions
- Shows: username, role badge, count
- Sorted: highest count first
- Title: "Top Loqholders"

### Loqees Leaderboard
- Metric: "Longest Loq Duration" = longest single loq session (in hours)
- Shows: username, role badge, duration
- Sorted: longest duration first
- Title: "Top Loqees"

---

## Page: `/leaderboard`

```
Tabs: [Top Loqholders] [Top Loqees]

Top Loqholders:
#1  🔑 username123     47 controlled loqs
#2  🔑 loqmaster       31 controlled loqs
#3  🔑 keychamp        28 controlled loqs
...

Top Loqees:
#1  🔒 submissive99    168 hours (7 days)
#2  🔒 devotee42       144 hours (6 days)
#3  🔒 trusting_one    96 hours (4 days)
...
```

---

## Database View

```sql
-- Loqholder leaderboard
CREATE VIEW loqholder_leaderboard AS
SELECT
  p.username,
  p.id,
  COUNT(r.id) AS controlled_loqs
FROM profiles p
JOIN relationships r ON r.loqholder_id = p.id
WHERE r.status = 'ended'
  AND p.status = 'active'
GROUP BY p.id, p.username
ORDER BY controlled_loqs DESC
LIMIT 100;

-- Loqee leaderboard
CREATE VIEW loqee_leaderboard AS
SELECT
  p.username,
  p.id,
  MAX(
    EXTRACT(EPOCH FROM (l.updated_at - l.created_at)) / 3600
  ) AS longest_loq_hours
FROM profiles p
JOIN relationships r ON r.loqee_id = p.id
JOIN loqs l ON l.relationship_id = r.id
WHERE l.locked = FALSE
  AND p.status = 'active'
GROUP BY p.id, p.username
ORDER BY longest_loq_hours DESC
LIMIT 100;
```

---

## API

```
GET /api/leaderboard/loqholders
  [Public – no auth required]
  Query: ?limit=50
  Returns: [{ username, controlled_loqs, rank }]

GET /api/leaderboard/loqees
  [Public – no auth required]
  Query: ?limit=50
  Returns: [{ username, longest_loq_hours, rank }]
```

---

## Privacy

- Only username shown (no email, no real name)
- Users can opt out of leaderboard in profile settings
- Banned users are excluded automatically
