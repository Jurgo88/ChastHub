# 🔄 ARCHITECTURE V2 – Major Pivot

**Date:** 2026-05-07
**Source:** Client meeting / feedback
**Status:** Active – needs implementation
**Impact:** ⚠️ BREAKING CHANGE

---

## 🎯 Core Changes

### **1. Loqee creates loq BEFORE pairing**

**Old flow:**
```
Loqee → finds loqholder → loqholder accepts → loqee creates loq
```

**New flow:**
```
Loqee → creates loq (duration, combination, emotion) →
finds loqholder(s) → loqholder accepts → loq starts
```

### **2. Loqee = 1 active loq, Loqholder = unlimited active loqs**

**Old constraint:**
```sql
UNIQUE(relationship_id) WHERE locked = TRUE
```

**New constraint:**
```sql
-- Only 1 active loq per loqee
UNIQUE(loqee_id) WHERE status IN ('pending', 'active')

-- Loqholder can have unlimited active loqs (no constraint)
```

### **3. Multi-target requesting**

Loqee can:
- Send loq request to multiple loqholders simultaneously
- Leave loq in public "queue" (any loqholder can accept)
- Combine both approaches
- Cancel loq manually anytime before acceptance

When ONE loqholder accepts → all other pending requests are auto-rejected.

### **4. Subscription model unchanged**

- Loqholder = FREE (no subscription)
- Loqee = paid subscription or 30-day free trial (must have access to create loq)

---

## 📋 Loq Lifecycle (NEW)

> ⚠️ **TASK-062 update (2026-08-04):** the clock now starts at step 1
> (creation), not step 3 (acceptance). `loqed_until` is computed once, on
> insert, and accept.post.ts never recomputes it. Accept still gates
> *control* (add/remove/pause/end) — it just doesn't gate the timer anymore.

```
1. CREATED (by loqee)
   - Duration set
   - Combination photo OR text field
   - Initial emotion picked
   - Status: 'draft'
   - loqed_until = NOW() + duration — loq clock starts immediately
   - Loqee sees a live countdown, plus "Find a loqholder to take control"
   ↓
2. REQUESTING (loqee finds loqholder)
   - Option A: Send direct request(s) to specific loqholder(s)
   - Option B: Publish to queue (any loqholder can accept)
   - Status: 'pending'
   - Clock keeps counting down; loqee sees list of pending requests alongside it
   ↓
3. ACCEPTED (loqholder accepts)
   - loqed_until untouched (already set at creation)
   - All other pending requests auto-rejected
   - Status: 'active'
   - locked = true — loqholder now has control
   ↓
4. ACTIVE (loq running)
   - Loqholder can: add/remove time, pause, end
   - Loqee can: send messages, change emotion, see countdown
   - Visitor link (if enabled)
   ↓
5. ENDED (time expired or manually ended)
   - Status: 'ended'
   - locked = false
   - Loqee can now create another loq
   - If the clock ran out before any loqholder ever accepted, the loq ends
     unattended the same way (no loqholder to notify)
```

---

## 🗄️ Database Schema Changes

### **New: `loqs` table (refactored)**

```sql
CREATE TABLE loqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner (loqee creates the loq)
  loqee_id UUID NOT NULL REFERENCES profiles(id),

  -- Active loqholder (NULL until accepted)
  loqholder_id UUID REFERENCES profiles(id),

  -- Status
  status TEXT CHECK (status IN ('draft', 'pending', 'active', 'paused', 'ended', 'cancelled')) DEFAULT 'draft',

  -- Loq config (set by loqee at creation)
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 1 AND 10080), -- 1min to 7 days
  combination_text TEXT,           -- combination as text (alternative to photo)
  combination_photo_url TEXT,      -- combination photo (alternative to text)
  emotion TEXT CHECK (emotion IN ('excited', 'chill', 'weak', 'nervous', 'hopeless')),
  reason TEXT,
  is_public BOOLEAN DEFAULT FALSE, -- visible in public queue

  -- Timer (set at creation — TASK-062, 2026-08-04; was "set when accepted")
  loqed_until TIMESTAMPTZ,         -- NOW() + duration_minutes, set on INSERT
  locked BOOLEAN DEFAULT FALSE,
  paused_at TIMESTAMPTZ,           -- set when loqholder pauses; NULL when running

  -- Visitor mode (after acceptance)
  public_link_id TEXT UNIQUE,
  visitor_add_hours NUMERIC DEFAULT 1,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,

  CONSTRAINT loqee_one_active UNIQUE (loqee_id) WHERE status IN ('draft', 'pending', 'active', 'paused'),
  CONSTRAINT combination_check CHECK (combination_text IS NOT NULL OR combination_photo_url IS NOT NULL),
  CONSTRAINT no_self_loq CHECK (loqee_id != loqholder_id)
);

CREATE INDEX idx_loqs_loqee ON loqs(loqee_id);
CREATE INDEX idx_loqs_loqholder ON loqs(loqholder_id);
CREATE INDEX idx_loqs_status ON loqs(status);
CREATE INDEX idx_loqs_public_link ON loqs(public_link_id);
```

### **New: `loq_requests` table (replaces relationships for pairing)**

```sql
-- Requests from loqee to specific loqholders
CREATE TABLE loq_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loq_id UUID NOT NULL REFERENCES loqs(id) ON DELETE CASCADE,
  loqholder_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'auto_rejected')) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  responded_at TIMESTAMP,

  UNIQUE(loq_id, loqholder_id)  -- can't send twice to same loqholder
);

CREATE INDEX idx_loq_requests_loq ON loq_requests(loq_id);
CREATE INDEX idx_loq_requests_loqholder ON loq_requests(loqholder_id);
```

### **Old: `relationships` table – DEPRECATED**

The `relationships` concept is replaced by:
- `loqs.loqee_id` + `loqs.loqholder_id` (1:1 link per loq)
- `loq_requests` (for pending requests before acceptance)

Messages now reference `loq_id` instead of `relationship_id`:

```sql
-- Update messages table
ALTER TABLE messages DROP CONSTRAINT messages_relationship_id_fkey;
ALTER TABLE messages RENAME COLUMN relationship_id TO loq_id;
ALTER TABLE messages ADD CONSTRAINT messages_loq_id_fkey
  FOREIGN KEY (loq_id) REFERENCES loqs(id) ON DELETE CASCADE;
```

---

## 🎨 New User Flows

### **Loqee Flow**

```
1. Login → Dashboard
   ↓
2a. No active loq?
   → "Start your loq now" CTA
   → Form: duration, combination (text/photo), emotion, reason
   → Submit → loq.status = 'draft'
   ↓
2b. Has active loq?
   → Show LoqClock with countdown
   → Show emotion picker, chat (if accepted)
   ↓
3. Find loqholder (after creating loq):
   → Browse leaderboard
   → Browse loqholder list
   → Browse loq queue (where loqees publish their loqs)
   → Select 1 or more → "Send Request"
   → loq.status = 'pending'
   → loq_requests created
   ↓
4. Wait for acceptance:
   → Live countdown already running (started at creation)
   → Show pending request count alongside it
   → Can cancel anytime
   ↓
5. Loq accepted:
   → loqed_until untouched — clock doesn't restart
   → All other requests auto-rejected
   → Chat opens with loqholder
```

### **Loqholder Flow**

```
1. Login → Dashboard
   ↓
2. See lists:
   → 🟢 Active Loqs (loqs they're controlling, with timers)
   → 📥 Incoming Requests (loqs sent to them specifically)
   → 🌐 Public Queue (loqs marked is_public = true)
   ↓
3. Click on incoming request:
   → See loq details (loqee profile, duration, emotion, reason)
   → Accept / Reject
   ↓
4. Accept:
   → loqs.loqholder_id = self
   → loqs.status = 'active'
   → loqs.loqed_until = NOW() + duration
   → All other loq_requests auto-rejected
   → Open chat
   ↓
5. Manage active loq:
   → Add/remove time
   → Pause/resume
   → End loq
   → Generate public visitor link
   → Chat with loqee
   ↓
6. Loqholder can have UNLIMITED active loqs simultaneously
```

---

## 🏠 Dashboard Designs

### **Loqee Dashboard**

```
┌─────────────────────────────────────────────────┐
│  ChastHub            Profile  Leaderboard  Shop ⌃  │
├─────────────────────────────────────────────────┤
│                                                 │
│  ╔═══════════════════════════════════╗         │
│  ║                                   ║         │
│  ║      ⏱  23h 45m 12s              ║         │
│  ║   ────────────────────            ║         │
│  ║   Loqed by: @alex                 ║         │
│  ║   Emotion: 🥺                     ║         │
│  ║                                   ║         │
│  ║   [Chat]  [Change Emotion]        ║         │
│  ║                                   ║         │
│  ╚═══════════════════════════════════╝         │
│                                                 │
│           [End loq early]                       │
│                                                 │
└─────────────────────────────────────────────────┘
```

**No active loq state:**
```
┌─────────────────────────────────────────────────┐
│  ChastHub            Profile  Leaderboard  Shop ⌃  │
├─────────────────────────────────────────────────┤
│                                                 │
│       ┌─────────────────────┐                  │
│       │                     │                  │
│       │    No active loq    │                  │
│       │                     │                  │
│       │  ┌───────────────┐  │                  │
│       │  │ Start your    │  │                  │
│       │  │ first loq →   │  │                  │
│       │  └───────────────┘  │                  │
│       │                     │                  │
│       └─────────────────────┘                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Pending state (waiting for acceptance):**
```
┌─────────────────────────────────────────────────┐
│  ⏱  23h 12m 04s — waiting for a loqholder       │
│                                                 │
│  Duration:  24 hours                            │
│  Combination: 4 7 2 9 (hidden)                  │
│  Emotion: 🥺                                    │
│                                                 │
│  Sent to: 3 loqholders                          │
│  Pending: 2  |  Rejected: 1                     │
│                                                 │
│  [Send to more]  [Cancel loq]                   │
└─────────────────────────────────────────────────┘
```

---

### **Loqholder Dashboard**

```
┌──────────────────────────────────────────────────────┐
│  ChastHub           Profile  Leaderboard  Shop  Stats   │
├──────────────────────────────────────────────────────┤
│                                                      │
│  📥 Incoming Requests (3)                            │
│  ┌────────────────────────────────────────────────┐ │
│  │ @sub99      24h     🥺   "Be tough on me"      │ │
│  │                          [Accept] [Reject]    │ │
│  ├────────────────────────────────────────────────┤ │
│  │ @loqee42    7d      😈   "First time"         │ │
│  │                          [Accept] [Reject]    │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  🟢 Active Loqs (4)                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ @sub1   │ │ @sub2   │ │ @sub3   │ │ @sub4   │   │
│  │ 23h 45m │ │ 02h 12m │ │ 5d 18h  │ │ 14m     │   │
│  │ 🥺      │ │ 😈      │ │ 😅      │ │ 😤      │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
│                                                      │
│  🌐 Public Queue (browse)                            │
│  ┌────────────────────────────────────────────────┐ │
│  │ @anyone     1h      😊   "Quick test"          │ │
│  │ @user12     3d      🥺   "Vacation lock"       │ │
│  │             [View all in queue →]              │ │
│  └────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

**Active loq detail (when clicked):**
```
┌─────────────────────────────────────────────────┐
│  ← Back to Dashboard                            │
│                                                 │
│  @sub1 – 23h 45m 12s                           │
│  Emotion: 🥺                                    │
│  Combination: [view photo / text]               │
│  Reason: "Be tough on me"                       │
│                                                 │
│  ⏱ Time controls                                │
│  [+15m] [+1h] [+8h] [+1d]                      │
│  [-15m] [-1h] [-8h] [-1d]                      │
│  [Pause] [End now]                             │
│                                                 │
│  💬 Chat                                        │
│  [chat window]                                  │
│                                                 │
│  🔗 Share visitor link                          │
│  [Generate public link]                         │
└─────────────────────────────────────────────────┘
```

---

## 🛒 Shop (Future, Phase 2)

```
┌─────────────────────────────────────────────────┐
│  Shop                                           │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌────────────┐                                │
│  │            │   ChastHub T-shirt                │
│  │   👕       │   €25.00                       │
│  │            │   Available: S, M, L, XL       │
│  └────────────┘                                │
│  [Buy on Shopify →]                            │
│                                                 │
│  Coming soon:                                   │
│  Product #2 (TBD)                               │
└─────────────────────────────────────────────────┘
```

**Implementation:**
- Shopify Buy Button SDK (embedded checkout)
- OR redirect to Shopify store
- TBD: which approach client prefers

---

## 📋 Navigation (Both Roles)

**Top nav:**
```
[Logo]  [Dashboard]  [Leaderboard]  [Shop]  [Profile ⌃]
                                              ├ Settings
                                              ├ Subscription (loqee only)
                                              ├ Stripe Connect (loqholder only)
                                              └ Logout
```

---

## ⚠️ Migration Plan

### **Phase 1: Database Migration**
1. Create new `loqs` table with new schema
2. Create new `loq_requests` table
3. Migrate data from old `relationships` + `loqs` (if any production data exists)
4. Update `messages.relationship_id` → `messages.loq_id`
5. Drop old `relationships` table (or keep deprecated for history)

### **Phase 2: Backend API Changes**
1. New: `POST /api/loqs/create` (loqee creates loq with config)
2. New: `POST /api/loqs/:id/request` (send to specific loqholders)
3. New: `POST /api/loqs/:id/publish` (publish to public queue)
4. New: `POST /api/loqs/:id/cancel` (loqee cancels before acceptance)
5. New: `POST /api/loqs/:id/accept` (loqholder accepts → starts timer)
6. New: `GET /api/loqholders/:id/incoming` (loqholder's pending requests)
7. New: `GET /api/loqs/queue` (public queue list)
8. Deprecated: `/api/relationships/*`

### **Phase 3: Frontend Changes**
1. New loqee dashboard (active loq OR start CTA)
2. New loqholder dashboard (3 sections: requests, active, queue)
3. New loq creation flow (loqee creates first, then finds loqholder)
4. New "find loqholder" flow (multi-select, public queue)
5. Update navigation: Profile, Leaderboard, Shop

### **Phase 4: Testing**
1. Loqee can only have 1 active loq at a time
2. Loqholder can have many active loqs simultaneously
3. Auto-reject when one accepts
4. Combination as text OR photo
5. Public queue visibility

---

## 🎫 New GitHub Issues to Create

- TASK-021: Database migration to V2 schema
- TASK-022: Refactor backend API to V2
- TASK-023: New Loqee Dashboard
- TASK-024: New Loqholder Dashboard (multi-loq view)
- TASK-025: New Loq Creation Flow (loqee creates first)
- TASK-026: Multi-target Loq Request System
- TASK-027: Public Loq Queue
- TASK-028: Combination as text field (alternative to photo)
- TASK-029: Shop integration scaffold (Shopify Buy Button)

---

## 🚨 Impact on Existing Tickets

| Ticket | Status | Action |
|--------|--------|--------|
| TICKET-003 (public/private toggle) | ✅ Still relevant | Now part of TASK-027 |
| TICKET-004 (profile pics on loq page) | ✅ Still relevant | Apply to new loq detail page |
| TASK-013 (Dashboards) | ⚠️ Replace | Use TASK-023 + TASK-024 instead |
| TASK-003 (Pairing System) | ⚠️ Replace | Use TASK-026 instead |
| TASK-004 (Loq System Core) | ✅ Mostly works | Schema migration via TASK-021 |
