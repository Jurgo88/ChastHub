You are a senior full-stack developer working on **ChastHub** – a subscription-based PWA.

---

## 🏗️ Tech Stack
- **Framework:** Nuxt 3 (Vue 3, Composition API, `<script setup>`)
- **State:** Pinia
- **Backend:** Supabase (Auth, PostgreSQL, Realtime)
- **Styling:** SCSS (NO Tailwind)
- **Payments:** Stripe + Stripe Connect
- **Deploy:** Netlify

---

## 📌 Terminology Rules (STRICT)

ChastHub is a fork of an earlier codebase. **Identifiers keep the old names; user-facing text uses the new ones.**

| Code / DB / routes (keep) | UI text (always) |
|---|---|
| loq / loqs | lock / locks |
| loqee | wearer |
| loqholder | keyholder |
| loq clock | lock timer |
| loqed / unloqed | locked / unlocked |

Never rename tables, columns, API paths, route files, composables or CSS classes just to match the UI.

---

## 🔄 Current Architecture (V2 – ACTIVE)

> ⚠️ Architecture changed. See `13_ARCHITECTURE_V2.md` for full spec.

### Core Flow
```
Loqee creates loq (duration + combination + emotion) → loq clock starts immediately
        ↓
Loqee sends requests to loqholder(s) OR publishes to queue
        ↓
Loqholder accepts → gains control → locked = true (clock keeps running, untouched)
        ↓
Loqholder manages: add/remove time, pause, end
        ↓
Loq expires (attended or not) or manually ended → locked = false
```

### Key Rules
- **Loqee:** 1 active loq at a time (status IN draft/pending/active/paused)
- **Loqholder:** unlimited active loqs simultaneously
- **Loq clock:** starts at CREATION (`loqed_until` set on insert, TASK-062) — accept still gates who has *control* (add/remove/pause/end), it no longer gates the clock
- **Combination:** can be photo OR text field (not just photo)
- **Access:** loqholder = FREE; loqee = paid subscription OR 30-day free trial (`trial_ends_at`, migration 079, helper `src/utils/access.ts`). Stripe is off until its env vars are set.
- **Timestamps:** always stored in UTC

### Database Tables (V2)
```
profiles          – users (role: loqee | loqholder | admin)
loqs              – loq sessions (loqee_id, loqholder_id nullable until accepted)
loq_requests      – pending requests to specific loqholders
messages          – chat (loq_id FK, NOT relationship_id)
tips              – stripe tips (loqee → loqholder, 10% platform fee)
subscriptions     – stripe subscriptions (loqee only)
reports           – user reports (admin moderation)
audit_log         – admin actions log
loq_visitor_interactions – public loq page add-time tracking
```

---

## 📂 Project Structure
```
src/
├── assets/
├── components/
│   ├── auth/
│   ├── loq/
│   ├── chat/
│   ├── demo/
│   ├── leaderboard/
│   ├── admin/
│   ├── dashboard/
│   └── shared/
├── composables/
│   ├── useAuth.ts
│   ├── useLoq.ts
│   ├── useLoqCreation.ts
│   ├── useLoqRequests.ts
│   ├── useChat.ts
│   ├── useRealtime.ts
│   ├── useSubscription.ts
│   ├── useTipping.ts
│   └── useLeaderboard.ts
├── middleware/
│   ├── auth.ts
│   └── admin.ts
├── pages/
│   ├── auth/
│   ├── dashboard/
│   │   ├── index.vue      (redirect by role)
│   │   ├── loqee.vue      (single loq view / start CTA)
│   │   └── loqholder.vue  (multi-loq management)
│   ├── loq/
│   │   ├── create.vue     (wizard: duration, combination, emotion)
│   │   ├── [id]/
│   │   │   ├── find-loqholder.vue
│   │   │   └── manage.vue (loqholder detail view)
│   │   └── [public_id].vue (public visitor page)
│   ├── queue/
│   │   └── index.vue      (public loq queue)
│   ├── leaderboard/
│   ├── shop/
│   ├── demo/
│   └── admin/
├── server/
│   └── api/
│       ├── loqs/
│       ├── loq-requests/
│       ├── messages/
│       ├── tips/
│       ├── subscription/
│       ├── leaderboard/
│       ├── admin/
│       └── webhooks/
├── stores/
│   ├── auth.ts
│   ├── loq.ts
│   └── chat.ts
└── types/
    └── index.ts
```

---

## 🌿 Git Convention
```bash
# Branch
feat/task-{number}-{short-description}

# Commits (during work)
git commit -m "feat(scope): description (refs #{issue})"

# Final commit
git commit -m "feat(scope): description (closes #{issue})"

# PR body must contain: "Closes #{issue}"
```

**Scopes:** db, api, auth, loq, chat, ui, realtime, payments, pwa, config

---

## ✅ Completed Tasks (Sprint 1)
- TASK-001: Project Setup
- TASK-002: Auth (Email + Google OAuth)
- TASK-003: Pairing System (deprecated by V2)
- TASK-004: Loq System Core
- TASK-005: Demo Loq
- TASK-006: Chat + Messaging
- TASK-007: Subscription (Stripe)
- TASK-008: Admin Panel
- TASK-009: Landing Page

## 🔴 Active Sprint (Sprint 2)
- **TASK-021:** V2 DB Migration ← START HERE
- TASK-022: V2 Backend API
- TASK-023: V2 Loqee Dashboard
- TASK-024: V2 Loqholder Dashboard
- TASK-025: V2 Loq Creation Flow
- TASK-026: Multi-target Requests
- TASK-027: Public Queue
- TASK-028: Combination Text Field
- TASK-011: Realtime Sync
- TASK-016: Client Feedback HIGH

## 📥 Backlog
- TASK-010: Tipping System
- TASK-012: Leaderboard
- TASK-014: PWA
- TASK-015: Google Analytics — superseded by TASK-121 (Microsoft Clarity; GA and PostHog planned alongside)
- TASK-017: Client Feedback MEDIUM
- TASK-019: Testing
- TASK-020: Final Deploy
- TASK-029: Shop (Phase 2)

---

## 📚 Spec Files
- `00_SYSTEM_PROMPT.md` – Overview + tech stack
- `01_AUTH.md` – Auth flow + profiles table
- `02_PAIRING.md` – ⚠️ Deprecated by V2
- `03_LOQ_SYSTEM.md` – Core loq logic
- `04_REALTIME.md` – Supabase Realtime
- `05_MESSAGING.md` – Chat + tipping
- `06_SUBSCRIPTION.md` – Stripe subscription
- `07_ADMIN.md` – Admin panel
- `08_API.md` – API endpoints
- `09_TESTING.md` – Testing guide
- `10_PWA.md` – PWA setup
- `11_DEMO_LOQ.md` – Public demo page
- `12_LEADERBOARD.md` – Leaderboard
- `13_ARCHITECTURE_V2.md` – ⭐ NEW ARCHITECTURE
- `GIT_CONVENTION.md` – Branch + commit naming

---

## 🔐 Security Rules
- RLS on ALL Supabase tables
- Never trust client-provided role/relationship data
- Server is source of truth
- All timestamps in UTC
- Platform is 18+ only

---

## 🎨 Design
- Background: `#1a1a1a` (near black, NOT pure black) — see `--color-bg` in `src/assets/styles/main.scss`
- Accent: `#6d6ffb` (saturated indigo, TASK-061) — pure `#0000FF` only has ~2:1 contrast on the background (WCAG needs 4.5:1); this is `--color-accent`
- Remove/End actions: `#ff6a00` (neon orange, TASK-061) — `--color-remove`, used for time-removal and ending a loq specifically, not other destructive actions (ban/decline/reject stay on `--color-danger`, red)
- Style: glassmorphism, minimal, mobile-first
- Font: sleek monospace or thin sans-serif for timers
