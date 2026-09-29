You are a senior full-stack developer building a production-ready MVP web application using modern best practices.

## 📌 Project Overview

A subscription-based Progressive Web App (PWA) called **ChastHub** where two users form a controlled relationship:
- **"Loqee"** – user being controlled (wears the lock)
- **"Loqholder"** – controller (holds the key)

The loqholder controls time-based **loqs** for the loqee. The system is server-driven with real-time updates and messaging. Focused, clean MVP that can be extended in Phase 2.

**Terminology rules:** code, DB and routes keep `loq / loqee / loqholder / loq clock`; all
user-facing text says `lock / wearer / keyholder / lock timer`. See CLAUDE_CODE_CONTEXT.md.

**Phase 1 constraint:** Each user can have at most 1 active loq session at a time.

---

## 👤 User Roles

**Loqee:**
- Creates a loq and assigns a loqholder
- Pays subscription to use the platform
- Can send messages (even while loqed)
- Adds emotion status (5 emojis) visible to visitors
- Uploads photo of loq combination on creation (loqholder sees it, loqee cannot see it again until unloqed)
- Cannot modify the loq once accepted

**Loqholder:**
- FREE to use (no subscription required)
- Receives loq requests from loqees, can accept or reject
- Can start, pause, end loq session
- Can add or remove time from the loq clock
- Can share a public loq link for visitors to add time
- Receives tips from loqees (100% of tip, platform takes 10% commission)
- Cannot create a loq themselves

**Admin:**
- Read-only access to all users, relationships, messages
- Can view messages to evaluate inappropriate behavior and issue bans
- Can ban users and handle reports
- Cannot set loqs

---

## 🔑 Phase 1 Features (in order of priority)

1. Authentication (Supabase Auth + Google OAuth + profiles table)
2. User Profiles (username, bio, role badge)
3. Pairing System (1:1, loqee initiates → loqholder accepts/rejects)
4. Loq System (timestamp-based, loq clock countdown)
5. Real-time Sync (Supabase Realtime)
6. Messaging + Tipping (text + tip button)
7. Subscription (Stripe, loqee only)
8. Demo Loq (public page, no login required)
9. Leaderboard (loqholders: controlled loqs count, loqees: longest loq duration)
10. Admin Panel (users, reports, messages, bans)
11. Analytics (Microsoft Clarity — page views, heatmaps and session recordings, gated on cookie consent)
12. PWA Support (installable, basic caching)

**Detailed specs: see 01_AUTH.md through 12_PWA.md**

---

## 🧱 Tech Stack (STRICT)

- **Framework:** Nuxt 3 (Vue 3, Composition API, `<script setup>`)
- **State management:** Pinia
- **Backend:** Supabase (Auth, PostgreSQL, Realtime)
- **Styling:** CSS or SCSS (no Tailwind)
- **Deployment:** Netlify
- **Payments:** Stripe (subscriptions) + Stripe Connect (tipping)
- **Analytics:** Microsoft Clarity (TASK-121)

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
│   └── shared/
├── composables/
│   ├── useAuth.ts
│   ├── useLoq.ts
│   ├── useChat.ts
│   ├── usePairing.ts
│   ├── useSubscription.ts
│   ├── useTipping.ts
│   └── useLeaderboard.ts
├── middleware/
│   ├── auth.ts
│   └── admin.ts
├── pages/
│   ├── auth/
│   ├── dashboard/
│   ├── pairing/
│   ├── relationship/
│   ├── demo/
│   ├── leaderboard/
│   └── admin/
├── server/
│   └── api/
│       ├── auth/
│       ├── relationships/
│       ├── loqs/
│       ├── messages/
│       ├── tips/
│       ├── subscription/
│       ├── demo/
│       ├── leaderboard/
│       └── admin/
├── stores/
│   ├── auth.ts
│   ├── loq.ts
│   └── chat.ts
└── types/
    └── index.ts
```

---

## ⚙️ Key Rules

- Server is the source of truth – never trust client state alone
- Composables contain business logic, components are UI-only
- Use middleware for auth/admin route protection
- Use Nuxt server routes for Stripe webhooks
- All timestamps stored in UTC
- Avoid overengineering – focus on correctness and clarity

---

## 🎨 Design

- Dark background (near black)
- Accent color: #6d6ffb (saturated indigo, TASK-061 — pure #0000FF fails WCAG contrast on this background)
- Remove/End actions: #ff6a00 (neon orange, TASK-061)
- Minimal, sleek, glassmorphism where appropriate
- Mobile-first

---

## 🔐 Security

- Row Level Security (RLS) on all Supabase tables
- Users can only access their own profile, relationship, messages
- Admin has elevated read access (including messages)
- Never trust client-provided role or relationship data
- Platform is 18+ only

---

## ❌ Out of Scope (Phase 2)

- Loq Shop (Shopify/Printful integration)
- Newsletter (Brevo/Listmonk)
- Advanced chat (images, reactions)
- Push/email notifications
- Multiple simultaneous relationships
- Gamification features
- Advanced Stripe Connect payouts

---

## 🎯 Success Criteria

MVP is done when:
- Auth, pairing, loq system, chat, tipping, payments all work
- Demo loq page is live and shareable
- Leaderboard is visible
- Admin can view and moderate content
- All critical edge cases handled
- RLS policies protect user data
- Deployed on Netlify with Microsoft Clarity active
