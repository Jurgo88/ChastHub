import { getLoungeStatus } from '~/server/utils/lounge'

// Public: the menu, the closed screen and the countdown all read this.
// Short CDN cache, the client keeps its own clock between fetches.
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=20')
  setResponseHeader(event, 'Netlify-CDN-Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
  return await getLoungeStatus()
})
