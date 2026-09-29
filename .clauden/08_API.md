# 08 – API Endpoints

All routes under `/api/` are Nuxt server routes.
All require auth unless marked as public.

---

## Auth

```
POST /api/auth/signup
  Body: { email, password, role }
  Returns: { user_id, token }
  Errors: 400 (validation), 409 (email exists)

POST /api/auth/login
  Body: { email, password }
  Returns: { user_id, token, role }
  Errors: 401, 429 (rate limit)

POST /api/auth/logout
  Returns: { success: true }

POST /api/auth/reset-password
  Body: { email }
  Returns: { success: true }
```

---

## Relationships (Pairing)

```
POST /api/relationships/invite
  [Loqholder only]
  Returns: { relationship_id, invite_code, expires_at }
  Errors: 403 (not loqholder), 409 (already in relationship)

GET /api/relationships/invite/:code
  [Public]
  Returns: { loqholder_name, expires_at }
  Errors: 404, 410 (expired)

POST /api/relationships/join/:code
  [Loqee only]
  Returns: { relationship_id, status: 'pending' }
  Errors: 404, 409, 410

POST /api/relationships/:id/confirm
  [Loqholder only]
  Returns: { status: 'active' }

POST /api/relationships/:id/end
  [Loqholder only]
  Returns: { success: true }

GET /api/relationships/mine
  Returns: { relationship, partner, lock_state }
```

---

## Locks

```
POST /api/loqs/:relationshipId/set
  [Loqholder only]
  Body: { duration_minutes: 120, reason?: string }
  Returns: { id, locked_until, countdown_seconds }
  Errors: 400 (invalid duration), 403, 410 (relationship ended)

POST /api/loqs/:relationshipId/change
  [Loqholder only]
  Body: { duration_minutes: 240 }
  Returns: { locked_until, countdown_seconds }

POST /api/loqs/:relationshipId/remove
  [Loqholder only]
  Returns: { success: true, locked: false }

GET /api/loqs/:relationshipId
  Returns: { locked, locked_until, countdown_seconds, reason }
  (Returns { locked: false } if no active lock)

GET /api/loqs/:relationshipId/history
  Query: ?limit=20&offset=0
  Returns: [{ id, locked_until, set_by, reason, created_at }]
```

---

## Messages

```
POST /api/messages/:relationshipId
  Body: { content: string }
  Returns: { id, sender_id, content, created_at }
  Errors: 400 (too long), 403, 410 (ended), 429 (rate limit)

GET /api/messages/:relationshipId
  Query: ?limit=50&offset=0
  Returns: [{ id, sender_id, sender_name, content, created_at }]
```

---

## Subscription

```
POST /api/subscription/checkout
  Body: { plan: 'premium', billing: 'monthly' | 'yearly' }
  Returns: { redirect_url }

GET /api/subscription/status
  Returns: { status, plan, current_period_end }

POST /api/subscription/cancel
  Returns: { success: true }

POST /api/webhooks/stripe
  [Public – verified via Stripe signature]
  Handles: checkout.session.completed, payment_failed, subscription.deleted
```

---

## Reports

```
POST /api/reports
  Body: { reported_user_id, reason, description? }
  Returns: { id, created_at }

GET /api/admin/reports
  [Admin only]
  Returns: [{ id, reported_user, reported_by, reason, status, created_at }]

POST /api/admin/reports/:id/resolve
  [Admin only]
  Body: { action: 'dismiss' | 'ban', reason? }
  Returns: { success: true }
```

---

## Admin

```
GET /api/admin/users
  Query: ?search=email&limit=50&offset=0
  Returns: [{ id, email, role, subscription_status, status, created_at }]

GET /api/admin/messages/:relationshipId
  [Admin only – for moderation]
  Query: ?limit=50&offset=0
  Returns: [{ id, sender_name, content, created_at }]

POST /api/admin/users/:id/ban
  Body: { reason }
  Returns: { success: true }
```

---

## Error Response Format (Consistent)

```json
{
  "error": true,
  "code": "RELATIONSHIP_ENDED",
  "message": "This relationship has ended and no longer accepts messages.",
  "status": 410
}
```

Always return JSON errors. Never return plain text or HTML for API errors.
