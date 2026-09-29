<script setup lang="ts">
// TASK-111 — site-wide SEO defaults. Anything set here is a fallback that a
// page can override; putting it in one place is what stops pages shipping
// untitled, which is how 28 of 32 of them shipped before.
const { public: { siteUrl } } = useRuntimeConfig()
const route = useRoute()

// Canonical is derived from the route rather than written per page: one place
// that is always right, instead of a tag each page has to remember. Query
// strings are dropped deliberately — ?utm_source=… is the same document, and
// pointing every variant at the clean URL is the whole point.
const canonical = computed(() => {
  // Strip any trailing slash so /terms/ and /terms resolve to one canonical,
  // but keep the root as "/" — "https://chasthub.com" without a path is not the
  // form the homepage should declare.
  const path = route.path.replace(/\/+$/, '')
  return `${siteUrl}${path || '/'}`
})

// TASK-112 — site-wide structured data. Deliberately limited to what is
// actually true and verifiable:
//
//   - no `potentialAction: SearchAction`, because /search is behind auth and
//     pointing Google at a search box that answers with a login screen is a
//     promise the site cannot keep
//   - no `aggregateRating`, and no `offers` on the app below — there are no
//     real ratings, and the subscription prices live in Stripe rather than in
//     this repo. Inventing either is what earns a manual action.
const organisation = {
  '@type': 'Organization',
  '@id': `${siteUrl}/#organization`,
  name: 'ChastHub',
  url: siteUrl,
  logo: `${siteUrl}/icons/pwa-512x512.png`,
}

useHead({
  htmlAttrs: { lang: 'en' },
  titleTemplate: title => (title ? `${title} · ChastHub` : 'ChastHub — Timed Lock & Keyholder App'),
  link: [{ rel: 'canonical', href: canonical }],
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        organisation,
        {
          '@type': 'WebSite',
          '@id': `${siteUrl}/#website`,
          name: 'ChastHub',
          url: siteUrl,
          inLanguage: 'en',
          publisher: { '@id': `${siteUrl}/#organization` },
        },
      ],
    }),
  }],
})

useSeoMeta({
  ogSiteName: 'ChastHub',
  ogType: 'website',
  ogLocale: 'en_US',
  ogImage: `${siteUrl}/images/og-default.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'ChastHub — the platform for Keyholders and Wearers',
  twitterCard: 'summary_large_image',
  twitterImage: `${siteUrl}/images/og-default.png`,
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <CookieBanner />
  <InstallBanner />
  <ConfirmDialog />
</template>
