import { normaliseUtm } from '~/utils/trackedLink'

// Short links for X: chasthub.com/x for the bio, chasthub.com/x/<campaign>
// for a post. They land on the home page with the UTM tags that signup
// records (TASK-164), so Insights can count X signups without a long
// ?utm_ link in the post itself. A server route rather than a netlify.toml
// redirect: on Netlify the Nuxt function answers before those rules apply.
// 302, so a campaign can be repointed later without browsers caching it.
export default defineEventHandler((event) => {
  const raw = getRouterParam(event, 'campaign') ?? ''
  const campaign = normaliseUtm(raw.split('/')[0] ?? '')
  const params = new URLSearchParams({
    utm_source: 'x',
    utm_medium: campaign ? 'post' : 'bio',
    utm_campaign: campaign || 'profile',
  })
  return sendRedirect(event, `/?${params}`, 302)
})
