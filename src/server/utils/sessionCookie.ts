import type { H3Event } from 'h3'

// TASK-082 — httpOnly fallback for session recovery when localStorage is
// wiped/isolated (in-app browsers, Private Browsing). Stores the Supabase
// refresh token only; access tokens are short-lived and never persisted
// server-side.
const COOKIE_NAME = 'sb_refresh_token'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export function setSessionCookie(event: H3Event, refreshToken: string) {
  setCookie(event, COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
}

export function getSessionCookie(event: H3Event): string | undefined {
  return getCookie(event, COOKIE_NAME)
}

export function clearSessionCookie(event: H3Event) {
  deleteCookie(event, COOKIE_NAME, { path: '/' })
}
