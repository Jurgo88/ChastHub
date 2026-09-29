# 🚀 HOW TO USE – Claude Code VS Code Extension

## 📁 Štruktúra súborov

```
chasthub/
├── .clauden/
│   ├── 00_SYSTEM_PROMPT.md       ← Vždy priložiť
│   ├── 01_AUTH.md
│   ├── 02_PAIRING.md
│   ├── 03_LOQ_SYSTEM.md          ← Najdôležitejší!
│   ├── 04_REALTIME.md            ← Broadcast channel docs (aktuálne)
│   ├── 05_MESSAGING.md
│   ├── 06_SUBSCRIPTION.md
│   ├── 07_ADMIN.md
│   ├── 08_API.md
│   ├── 09_TESTING.md
│   ├── 10_PWA.md
│   ├── 11_DEMO_LOQ.md
│   ├── 12_LEADERBOARD.md
│   ├── 13_ARCHITECTURE_V2.md     ← V2 pivot doc (aktuálna DB schema)
│   └── GIT_CONVENTION.md         ← Branch + commit konvencia
```

---

## 📋 Stav implementácie (2026-05-22)

| Krok | Feature | Stav |
|------|---------|------|
| 1 | Project Setup | ✅ Done |
| 2 | Auth (Email + Google) | ✅ Done |
| 3 | Pairing (V2 flow) | ✅ Done |
| 4 | Loq System | ✅ Done |
| 5 | Demo Loq | ✅ Done |
| 6 | Realtime + Chat | ✅ Done (Broadcast channels) |
| 7 | Subscription (Stripe) | ✅ Done |
| 8 | Leaderboard | ✅ Done |
| 9 | Admin Panel | ✅ Done |
| 10 | Dashboard | ✅ Done (loqee.vue + loqholder.vue) |
| – | PWA | ❌ Not started |
| – | Google Analytics | ❌ Not started |

---

## 📋 Workflow: Feature-by-feature

Jeden feature = jeden prompt.

---

### KROK 1: Project Setup ✅

```
"Initialize Nuxt 3 project for ChastHub.
See .clauden/00_SYSTEM_PROMPT.md for architecture.

Create:
- nuxt.config.ts (TypeScript, Pinia, Supabase, PWA, Google Analytics)
- src/plugins/supabase.ts
- src/types/index.ts
- src/middleware/auth.ts
- src/middleware/admin.ts
- .env.example with all required variables"
```

---

### KROK 2: Auth (Email + Google)

```
"Implement authentication with email/password AND Google OAuth.
See .clauden/01_AUTH.md

Create:
- src/pages/auth/signup.vue
- src/pages/auth/login.vue
- src/pages/auth/reset-password.vue
- src/composables/useAuth.ts
- src/stores/auth.ts
- src/server/api/auth/signup.ts
- src/server/api/auth/login.ts
- src/server/api/auth/logout.ts
- supabase/migrations/001_profiles.sql"
```

---

### KROK 3: Pairing (Loqee initiates)

```
"Implement pairing system where LOQEE initiates.
See .clauden/02_PAIRING.md

Loqee sends request → Loqholder accepts/rejects.
NOT invite code. Loqee browses and requests a loqholder.

Create:
- src/pages/pairing/browse.vue (browse loqholders)
- src/pages/pairing/request.vue
- src/composables/usePairing.ts
- src/server/api/relationships/request.ts
- src/server/api/relationships/[id]/accept.ts
- src/server/api/relationships/[id]/reject.ts
- src/server/api/relationships/[id]/end.ts
- supabase/migrations/002_relationships.sql"
```

---

### KROK 4: Loq System (MOST IMPORTANT)

```
"Implement the loq system (NOT lock - loq).
See .clauden/03_LOQ_SYSTEM.md

Features:
- Loqee creates loq + uploads combination photo
- Loqholder accepts/rejects/pauses/ends
- Loq clock countdown (client-side)
- Add/remove time
- Emotion status (5 emojis)
- Public share link for visitors

Create:
- src/components/loq/LoqClock.vue
- src/components/loq/LoqControls.vue
- src/components/loq/EmotionPicker.vue
- src/composables/useLoq.ts
- src/server/api/loqs/create.ts
- src/server/api/loqs/[id]/accept.ts
- src/server/api/loqs/[id]/add-time.ts
- src/server/api/loqs/[id]/remove-time.ts
- src/server/api/loqs/[id]/pause.ts
- src/server/api/loqs/[id]/end.ts
- src/server/api/loqs/[id]/share.ts
- supabase/migrations/003_loqs.sql"
```

---

### KROK 5: Demo Loq (LAUNCH PRIORITY)

```
"Implement the public demo loq page - NO login required.
See .clauden/11_DEMO_LOQ.md

This is the marketing launch feature - highest priority after loq system.

Create:
- src/pages/loq/[public_id].vue (public loq page)
- src/pages/demo/index.vue (always-on demo loq)
- src/components/demo/LoqClockPublic.vue
- src/server/api/demo/loq/[public_id].ts
- src/server/api/demo/loq/[public_id]/add-time.ts
- supabase/migrations/004_loq_visitor_interactions.sql"
```

---

### KROK 6: Realtime + Chat + Tipping

```
"Implement realtime sync, messaging and tipping.
See .clauden/04_REALTIME.md and .clauden/05_MESSAGING.md

Tipping: loqee tips loqholder, platform takes 10%.
Tip button in chat. Stripe Connect for loqholder payouts.

Create:
- src/composables/useRealtime.ts
- src/composables/useChat.ts
- src/composables/useTipping.ts
- src/components/chat/ChatWindow.vue
- src/components/chat/ChatInput.vue (with tip button)
- src/server/api/messages/[relationshipId]/index.ts
- src/server/api/tips/create.ts
- supabase/migrations/005_messages_and_tips.sql"
```

---

### KROK 7: Subscription (Loqee only)

```
"Implement Stripe subscription - LOQEE ONLY.
See .clauden/06_SUBSCRIPTION.md

Loqholders are FREE. Only loqees need subscription.

Create:
- src/composables/useSubscription.ts
- src/pages/subscription/upgrade.vue
- src/pages/subscription/success.vue
- src/server/api/subscription/checkout.ts
- src/server/api/subscription/status.ts
- src/server/api/webhooks/stripe.ts
- supabase/migrations/006_subscriptions.sql"
```

---

### KROK 8: Leaderboard

```
"Implement public leaderboard.
See .clauden/12_LEADERBOARD.md

Two tabs: Top Loqholders (controlled loqs count) 
          Top Loqees (longest loq duration)

Create:
- src/pages/leaderboard/index.vue
- src/components/leaderboard/LeaderboardTable.vue
- src/composables/useLeaderboard.ts
- src/server/api/leaderboard/loqholders.ts
- src/server/api/leaderboard/loqees.ts
- supabase/migrations/007_leaderboard_views.sql"
```

---

### KROK 9: Admin Panel

```
"Implement admin panel.
See .clauden/07_ADMIN.md

Create:
- src/pages/admin/index.vue
- src/pages/admin/users/index.vue
- src/pages/admin/messages/[relationshipId].vue
- src/pages/admin/reports/index.vue
- src/server/api/admin/users/index.ts
- src/server/api/admin/users/[id]/ban.ts
- src/server/api/admin/messages/[relationshipId].ts
- supabase/migrations/008_reports.sql"
```

---

### KROK 10: Dashboard + PWA + Analytics

```
"Implement main dashboards, PWA and Google Analytics.
See .clauden/10_PWA.md

Loqholder dashboard: pending requests, active loq, chat
Loqee dashboard: current loq clock, emotion, chat

Create:
- src/pages/dashboard/index.vue
- src/pages/dashboard/loqholder.vue
- src/pages/dashboard/loqee.vue
- src/plugins/analytics.ts (Google Analytics)
- PWA manifest and icons"
```

---

## 💡 Dôležité Naming Rules

```
❌ NIKDY nepoužívaj:        ✅ VŽDY použi:
lock                        loq
unlock                      unloq
timer                       loq clock
keyholder                   loqholder
lockee                      loqee
session                     loq session
```
