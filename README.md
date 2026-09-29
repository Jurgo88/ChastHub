# ChastHub

PWA that pairs **wearers** and **keyholders** around timed **locks**. [chasthub.com](https://chasthub.com), launching 1 October 2026.

- A wearer creates a lock (duration, combination, emotion). The **lock timer** starts on creation.
- The lock is either a self-lock, a request to one keyholder, or listed in **Discover**.
- The keyholder takes control: add or remove time, pause, end.
- Visitors on the public share link can add or remove time, as the keyholder allows.
- Keyholders are free. Wearers get a **30-day free trial**; paid plans (Stripe) come later.

> **Terminology.** The UI says *lock / wearer / keyholder / lock timer*. The code, routes,
> API and database keep the inherited names (`loq`, `loqee`, `loqholder`, `loqs` table,
> `/api/loq...`). Page URLs are user-facing and use the new words: `/lock/...`,
> `/dashboard/wearer`, `/dashboard/keyholder` (old `/loq/...` URLs 301 to `/lock/...`).

Platform is **18+ only**.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Nuxt 3 (hybrid SSR), Vue 3 `<script setup>`, TypeScript (strict) |
| State | Pinia |
| Styling | SCSS, no Tailwind |
| Backend | Nuxt server routes (Nitro), Supabase: Auth, Postgres + RLS, Realtime (Broadcast / Presence), Storage |
| Payments | Stripe Checkout + webhooks |
| Notifications | Web Push (VAPID, `web-push`) |
| PWA | `@vite-pwa/nuxt`, `injectManifest` with `src/service-worker.ts` |
| Analytics | Microsoft Clarity, Google Analytics 4 |
| Hosting | Netlify (Nitro `netlify` preset) |
| Tests | Vitest, `test-api.sh` |

---

## Quick start

Requirements: Node 20+, npm, Supabase CLI (for migrations).

```bash
npm install
cp .env.example .env   # fill in values, see below
npm run dev            # http://localhost:3000
```

---

## Environment variables

| Variable | Scope | Notes |
|---|---|---|
| `NUXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NUXT_PUBLIC_SUPABASE_ANON_KEY` | public | Anon key. Public by design, so RLS is the security boundary |
| `NUXT_SUPABASE_SERVICE_KEY` | server | Service role. Only used via `server/utils/supabaseAdmin.ts` |
| `DATABASE_URL` | CLI | Used by `npm run migrate` |
| `NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | public | |
| `NUXT_STRIPE_SECRET_KEY` | server | Use test-mode keys locally |
| `NUXT_STRIPE_WEBHOOK_SECRET` | server | |
| `NUXT_STRIPE_MONTHLY_PRICE_ID` | server | Not in `.env.example` yet |
| `NUXT_STRIPE_YEARLY_PRICE_ID` | server | Not in `.env.example` yet |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_EMAIL` | mixed | Web Push |
| `NUXT_PUBLIC_SIGNUPS_ENABLED` | public | `true` = open signup, `false` = login + waitlist |
| `NUXT_PUBLIC_REQUIRE_EMAIL_CONFIRMATION` | public | Needs "Confirm email" + custom SMTP in Supabase first |
| `NUXT_PUBLIC_SITE_URL` | public | Canonical origin, defaults to `https://chasthub.com` |
| `NUXT_PUBLIC_CLARITY_PROJECT_ID` | public | Optional. Empty = Clarity off (no fallback) |
| `NUXT_PUBLIC_GA_MEASUREMENT_ID` | public | Optional. Empty = GA off (no fallback) |

The build does **not** need production secrets. The Supabase client plugins are client-only.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `preview` | Production build / local preview |
| `npm test` / `test:watch` | Vitest |
| `npm run lint` | ESLint |
| `npm run migrate` | `supabase db push --db-url $DATABASE_URL` |
| `npm run build:icons` | Regenerate PWA icons |
| `bash test-api.sh` | API smoke tests against a running server (needs `curl`, `jq`) |

---

## Project structure

```
src/
├── pages/            # file-based routes (auth, dashboard, lock, discover, messages,
│                     #   profile, user/[username], leaderboard, subscription, admin, legal)
├── components/       # loq/, dm/, leaderboard/ + shared UI
├── composables/      # useAuth, useLoq, useLoqholder, usePublicLoq, useDiscoverFeed,
│                     #   useMessaging, useSubscription, usePushNotifications, ...
├── stores/           # Pinia: auth, loq
├── middleware/       # auth, admin, subscription
├── plugins/          # supabase, auth (client-only), clarity, ga
├── server/
│   ├── api/          # REST endpoints grouped by domain
│   ├── routes/       # sitemap.xml
│   └── utils/        # supabaseAdmin, auth, rateLimit, broadcastLoq, expireLoq, ...
├── service-worker.ts # PWA + push
└── assets/styles/    # main.scss (design tokens), partials
supabase/migrations/  # SQL migrations (source of truth for schema + RLS)
test/                 # Vitest suites
.clauden/             # feature specs (00–13) + GIT_CONVENTION.md
```

---

## Rendering model

Defined in `routeRules` in `nuxt.config.ts`.

| Routes | Mode |
|---|---|
| `/`, `/install`, `/privacy`, `/terms`, `/faq` | Prerendered at build |
| `/lock/**` (public lock page) | SSR, 60 s CDN cache, so OG tags carry the real loq |
| `/dashboard`, `/admin`, `/profile`, `/messages`, `/discover`, `/auth`, `/subscription`, `/leaderboard`, `/shop` | Client-only, `noindex` |

---

## Free trial and payments

Payments are off until the Stripe keys are set. Meanwhile:

- `profiles.trial_ends_at` defaults to `now() + 30 days` (migration `079`), so every signup gets a trial.
- Premium access = `subscription_status = 'active'` **or** a running trial: `src/utils/access.ts`, used by `requireActiveSubscription`, the `subscription` middleware, the auth store (`hasAccess`, `isOnTrial`, `trialDays`) and a few server routes.
- `/subscription/upgrade` shows the trial state instead of plans while `NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is empty; the Stripe routes answer `503`.
- To go live with payments: set the Stripe env vars below and point the Stripe webhook at `/api/webhooks/stripe`.

## Database

- Migrations live in `supabase/migrations`, numbered `001`–`079` (`058` and `066` intentionally skipped). Apply them with `npm run migrate`.
- Core tables: `profiles`, `loqs`, `loq_requests`, `messages`, `loq_visitor_interactions`, `conversations`, `dm_messages`, `favorites`, `subscriptions`, `payments`, `push_subscriptions`, `reports`, `audit_log`, `rate_limit_buckets`.
- **RLS is the security boundary.** The anon key ships in the bundle, so anyone can call PostgREST directly. Clients never write to `profiles` or `loqs`. All writes go through `/api/**` using the service-role client, and every table has RLS. Schema changes go through migrations only, never through the dashboard.
- Realtime uses server-side **Broadcast** (`broadcastLoqUpdate`) and Presence, not `postgres_changes` on private tables.
- All timestamps are UTC.

---

## Testing

- `test/*.test.ts`: unit tests with mocked Supabase (`test/helpers/mockSupabase.ts`).
- `test/rls.security.test.ts`: RLS regression test against a **real staging project**. Opt-in: set `RLS_TEST_SUPABASE_URL`, `RLS_TEST_ANON_KEY` and `RLS_TEST_SERVICE_KEY`. Never run it against production.
- `test-api.sh`: API smoke tests, also run in CI.

---

## CI / CD

| Workflow | Trigger | Purpose |
|---|---|---|
| `api-tests.yml` | push / PR to `main`, only when repo variable `API_TESTS_ENABLED=true` | Build, start server, run `test-api.sh` |
| `backup.yml`, `backup-restore-test.yml` | manual only (schedule commented out) | Nightly R2 backup, see `docs/BACKUPS.md` |

**Deploy:** Netlify builds from `main` (`netlify.toml`, Node 20). Redirects live in `netlify.toml`, not `_redirects`. Stripe webhook endpoint: `/api/webhooks/stripe`.

---

## Conventions

**Terminology in the UI:**

| Code / DB | UI text |
|---|---|
| loq / loqs | lock / locks |
| loqee | wearer |
| loqholder | keyholder |
| loq clock | lock timer |
| loqed / unloqed | locked / unlocked |

**Git:** see `.clauden/GIT_CONVENTION.md`.

- Branch: `{type}/task-{number}-{short-description}`
- Commits: `type(scope): description (refs #N)`, and `(closes #N)` on the final one
- One PR per task

---

## Docs

- `CLAUDE_CODE_CONTEXT.md`: current architecture and rules for AI-assisted work
- `.clauden/`: feature specs
