// Served at /sitemap.xml. Kept as a server route rather than a static file so
// the list stays next to the code that defines the routes it describes.

// Only pages with real, public, indexable content. Deliberate exclusions:
//   /shop        — "coming soon" placeholder; submitting it would put a thin page
//                  in front of Google while the site is establishing trust
//   /demo        — a 301 redirect, never a canonical destination (see netlify.toml)
//   /lock/<id>   — user-generated and time-limited. They stay crawlable and carry
//                  Open Graph tags for sharing, but listing them here would fill
//                  the index with thin, short-lived pages.
//   /stats       — noindex (TASK-119, was /leaderboard). Its rows load client-side, so a crawler
//                  only ever saw "No entries yet"; and rendering them server-side
//                  instead would make pseudonymous display names searchable in
//                  Google, which the opt-out toggle does not ask people about.
//   anything behind auth — dashboard, profile, messages, search, admin
const PUBLIC_ROUTES = [
  '/',
  '/faq',
  '/install',
  '/privacy',
  // TASK-172 — the canonical URL of the report form (/security is an alias).
  '/report',
  '/terms',
]

export default defineEventHandler((event) => {
  const { public: { siteUrl } } = useRuntimeConfig()

  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'public, max-age=3600')

  // No <lastmod>: a timestamp regenerated on every request is not a real
  // modification date, and Google discounts lastmod it finds unreliable.
  // <changefreq> and <priority> are omitted for the same reason — Google
  // ignores both.
  const urls = PUBLIC_ROUTES
    .map(route => `  <url><loc>${siteUrl}${route}</loc></url>`)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
})
