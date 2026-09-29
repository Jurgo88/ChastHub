import type { H3Event } from 'h3'

// TASK-144 — h3's getRequestIP only looks at x-forwarded-for when it is asked
// to, and otherwise falls back to event.node.req.socket.remoteAddress. On
// Netlify there is no real socket: Nitro runs on unenv's polyfill, whose
// Socket sets remoteAddress to "" — falsy, so getRequestIP returns undefined
// and every caller collapses onto whatever sentinel the route used.
//
// That turned every per-IP rate limit into a single global one: one visitor's
// vote locked every other visitor out of a loq for an hour, and five failed
// logins from anyone would have locked the whole site out of logging in.
//
// Returns null when the address genuinely cannot be determined, so callers
// decide what that means rather than silently sharing a bucket.
export function getClientIp(event: H3Event): string | null {
  // Netlify sets this on every request and it is not client-controllable.
  const netlifyIp = getRequestHeader(event, 'x-nf-client-connection-ip')?.trim()
  if (netlifyIp) return netlifyIp

  // Standard proxy header: first hop is the client, the rest are proxies.
  // Spoofable in principle, but we are always behind Netlify's proxy, which
  // appends rather than trusts what the client sent.
  const forwarded = getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded) return forwarded

  // Local dev and any runtime with a real socket.
  const direct = getRequestIP(event)
  return direct && direct.length > 0 ? direct : null
}
