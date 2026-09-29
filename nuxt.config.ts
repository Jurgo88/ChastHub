// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon-180x180.png' },
        // Discovered inside main.scss otherwise, so the browser would only
        // start fetching it after the stylesheet had downloaded and parsed.
        // Only the latin subset is preloaded — latin-ext is fetched on demand
        // via unicode-range, and preloading it would download 83 KB that most
        // visitors never render a glyph from (TASK-115).
        {
          rel: 'preload',
          as: 'font',
          type: 'font/woff2',
          href: '/fonts/inter-latin.woff2',
          crossorigin: 'anonymous',
        },
      ],
      meta: [
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'ChastHub' },
      ],
    },
  },

  // TASK-110 — hybrid rendering. Previously `ssr: false`, which made every
  // URL return an empty shell with no title and no content: nothing was
  // indexable and link previews were blank.
  //
  // This has to be `true` globally. Nuxt only supports disabling SSR per
  // route, not enabling it: with `ssr: false` here the client is built in
  // SPA mode, and a `routeRules` entry of `ssr: true` cannot bring server
  // rendering back — prerendering such a route just writes the empty shell
  // to a static file (verified: `data-ssr="false"`, empty `__nuxt` div).
  //
  // Safe because auth never renders on the server: the auth plugin is
  // client-only, AppNav is wrapped in <ClientOnly>, and every private route
  // group opts out of SSR below.
  ssr: true,

  routeRules: {
    // Static marketing and legal pages — prerendered to plain HTML at build
    // time, so they are served from the CDN with no function invocation
    // (see #307) and no render latency.
    '/': { prerender: true },
    '/install': { prerender: true },
    '/privacy': { prerender: true },
    '/terms': { prerender: true },
    '/faq': { prerender: true },

    // Rendered per request rather than prerendered: content is user-generated
    // and changes as the countdown runs. SSR is what lets Open Graph tags
    // carry the actual loq (#299).
    //
    // Cached at the CDN edge for a short window (#307). A shared loq link
    // going viral is the success case for this product, and without this
    // every one of those views would invoke a function on the Netlify free
    // tier. 60s is safe for the countdown: the clock ticks client-side from
    // `loqed_until`, an absolute timestamp, so a document up to a minute old
    // still renders the correct remaining time. `stale-while-revalidate`
    // keeps serving from cache while a fresh copy is fetched behind it.
    //
    // Only the CDN caches it — the browser is told not to, so a visitor
    // returning to the page still sees their own adjustment reflected.
    '/lock/**': {
      headers: {
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Netlify-CDN-Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    },

    // Leaderboard is noindex (TASK-119). It was server-rendered and in the
    // sitemap, but its data loads in onMounted, so the only thing a crawler
    // ever saw was the empty state — "No entries yet" — while the API returned
    // a full board. Google was being handed a page advertising a dead product.
    //
    // Server-rendering the real board would fix that but would publish
    // pseudonymous display names to Google. `leaderboard_opt_out` is consent to
    // appear on the board in the app, which is not the same as consent to being
    // searchable by name — not a call to make silently on an 18+ platform.
    // See the issue for that decision.
    //
    // ssr: false follows from noindex: the data arrives client-side either way,
    // so rendering a server pass bought nothing but a function invocation (#307).
    '/leaderboard': { ssr: false, headers: { 'X-Robots-Tag': 'noindex, follow' } },

    // Private areas render client-side only and are kept out of the index.
    // robots.txt asks crawlers not to fetch these; X-Robots-Tag covers
    // anything that reaches them anyway (a direct link, a crawler ignoring
    // robots.txt).
    '/admin/**': { ssr: false, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/dashboard/**': { ssr: false, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/profile/**': { ssr: false, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/messages/**': { ssr: false, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/discover/**': { ssr: false, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/auth/**': { ssr: false, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/subscription/**': { ssr: false, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },

    // Coming-soon placeholder — nothing to index until the shop ships.
    '/shop': { ssr: false, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },

    // TASK-142/143 — the loqholder queue became Discover, and user search
    // moved into Messages. Both old URLs are in people's history and in
    // links we have already sent out.
    // Public URLs say "lock"; the inherited /loq/ paths redirect for safety.
    '/loq/**': { redirect: { to: '/lock/**', statusCode: 301 } },
    '/search': { redirect: { to: '/messages', statusCode: 301 } },
  },

  srcDir: 'src/',

  modules: [
    '@pinia/nuxt',
    '@vite-pwa/nuxt',
  ],

  // Explicit order: supabase must load before auth session restoration.
  //
  // Both are client-only. The Supabase browser client is only ever used from
  // the browser — every call site is inside onMounted, an event handler, or
  // behind an `import.meta.client` guard — and server code reaches Supabase
  // through `useSupabaseAdmin` in server/utils instead.
  //
  // Making it client-only is what keeps the build from needing Supabase
  // credentials: since TASK-110 turned SSR on, this plugin ran during
  // prerendering, and `createClient(undefined, undefined)` threw, so every
  // prerendered route failed with a 500 wherever those env vars were absent.
  // A build should not require production secrets.
  plugins: [
    { src: '~/plugins/supabase', mode: 'client' },
    { src: '~/plugins/auth', mode: 'client' },
    { src: '~/plugins/clarity.client', mode: 'client' },
    { src: '~/plugins/ga.client', mode: 'client' },
  ],

  runtimeConfig: {
    // Private (server-only)
    supabaseServiceKey: process.env.NUXT_SUPABASE_SERVICE_KEY,
    stripeSecretKey: process.env.NUXT_STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.NUXT_STRIPE_WEBHOOK_SECRET,
    stripeMonthlyPriceId: process.env.NUXT_STRIPE_MONTHLY_PRICE_ID,
    stripeYearlyPriceId: process.env.NUXT_STRIPE_YEARLY_PRICE_ID,
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
    vapidEmail: process.env.VAPID_EMAIL,

    // Public (exposed to client)
    public: {
      supabaseUrl: process.env.NUXT_SUPABASE_URL,
      supabaseAnonKey: process.env.NUXT_SUPABASE_ANON_KEY,
      // Empty = payments off: the upgrade page shows the free-trial state.
      stripePublishableKey: process.env.NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.NUXT_STRIPE_PUBLISHABLE_KEY || '',
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
      signupsEnabled: process.env.NUXT_PUBLIC_SIGNUPS_ENABLED === 'true',
      // TASK-123 — when true, a new account must click the link in its
      // confirmation mail before it can log in. Off by default: it also
      // needs "Confirm email" switched on in the Supabase project AND
      // custom SMTP configured there (the built-in mailer caps at ~3
      // mails/hour and silently drops the rest). Existing accounts were
      // created pre-confirmed and are unaffected either way.
      requireEmailConfirmation: process.env.NUXT_PUBLIC_REQUIRE_EMAIL_CONFIRMATION === 'true',
      // Canonical origin. Used by the sitemap, and by canonical tags and
      // Open Graph URLs once TASK-111 lands.
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://chasthub.com',
      // Microsoft Clarity project (TASK-121). Off unless the env var is set —
      // there is deliberately no hard-coded fallback project.
      clarityProjectId: process.env.NUXT_PUBLIC_CLARITY_PROJECT_ID ?? '',
      // Google Analytics 4 (TASK-140). Off unless the env var is set — there
      // is deliberately no hard-coded fallback property.
      gaMeasurementId: process.env.NUXT_PUBLIC_GA_MEASUREMENT_ID ?? '',
    },
  },

  pwa: {
    strategies: 'injectManifest',
    srcDir: '.',
    filename: 'service-worker.ts',
    registerType: 'autoUpdate',
    manifest: {
      name: 'ChastHub',
      short_name: 'ChastHub',
      description: 'ChastHub — your keyholder app',
      theme_color: '#0E0033',
      background_color: '#0E0033',
      display: 'standalone',
      orientation: 'portrait',
      scope: '/',
      start_url: '/',
      icons: [
        { src: '/icons/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
        { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    // pwaAssets generates icons next to the source image, not into /icons/
    // where the manifest expects them — disabled in favor of the static
    // placeholder files committed at src/public/icons/.
    //
    // The source lives under assets/, not public/: anything in public/ is
    // copied to dist and precached by the service worker whether or not it is
    // used, and this master image is 1.4 MB. Unimported files under assets/
    // are not bundled at all (TASK-114).
    pwaAssets: {
      disabled: true,
      preset: 'minimal-2023',
      image: 'src/assets/images/logos/chasthub-icon.png',
    },
    injectManifest: {
      // `webp` matters: the logos and role icons are WebP since TASK-114, and
      // without it here they drop out of the precache and fail offline.
      globPatterns: ['**/*.{js,css,html,svg,png,webp,ico,woff2}'],
      // The Open Graph card is only ever fetched by social crawlers — no app
      // user needs it, so precaching it just costs every installer 75 KB.
      globIgnores: ['**/images/og-default.png'],
    },
    client: {
      installPrompt: true,
    },
    devOptions: {
      enabled: process.env.NODE_ENV === 'development',
      type: 'module',
    },
  },

  css: ['~/assets/styles/main.scss'],

  typescript: {
    strict: true,
  },

  nitro: {
    preset: 'netlify',

    prerender: {
      // Emit `install.html` rather than `install/index.html`. With the default
      // Netlify normalises /install to /install/ with a 301, which would make
      // every prerendered URL in sitemap.xml redirect, and would 301 the app's
      // own links too — they all point at the slashless form.
      autoSubfolderIndex: false,
    },
  },
})
