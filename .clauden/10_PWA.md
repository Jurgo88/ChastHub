# 10 – PWA Support

## Requirements

- App is installable (Add to Home Screen)
- Basic caching for static assets
- No advanced offline mode required

---

## Setup (Nuxt 3 + Vite PWA Plugin)

```bash
npm install -D @vite-pwa/nuxt
```

```javascript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@vite-pwa/nuxt'],
  pwa: {
    manifest: {
      name: 'ChastHub',
      short_name: 'ChastHub',
      theme_color: '#000000',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
      ]
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com/,
          handler: 'CacheFirst'
        }
      ]
    }
  }
});
```

---

## Caching Strategy

- Static assets (JS, CSS, fonts): Cache-first
- API calls: Network-first (always fresh data)
- No offline fallback page in MVP

---

## Required Assets

- `/public/icons/icon-192.png`
- `/public/icons/icon-512.png`
- `/public/favicon.ico`

---

## Troubleshooting

### `nuxt dev` fails with "Failed to resolve import '#app-manifest'"

```
Pre-transform error: Failed to resolve import "#app-manifest" from
"node_modules/nuxt/dist/app/composables/manifest.js?v=...".
Plugin: vite:import-analysis
```

**Cause:** stale Vite dependency pre-bundle cache in `node_modules/.cache`,
typically left behind after running `npm run build` (production build) and
then going back to `npm run dev`. Deleting `.nuxt` alone does **not** fix
this — the bad cache lives in `node_modules/.cache`, not `.nuxt`.

**Fix:**
```bash
npx nuxi cleanup   # removes .nuxt, .output, node_modules/.cache
npx nuxi prepare   # regenerates .nuxt types
npm run dev
```

If a dev server is still holding the port, stop it first (check with
`netstat -ano | grep LISTENING` on the port `nuxt dev` reports, e.g. 3000).
