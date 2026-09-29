# 06 – Subscription (Stripe)

## Key Rule
**Subscription is ONLY required for Loqee users.**
**Loqholders are FREE to use the platform.**

---

## Plans

**Loqholder (always free):**
- Full access to all loqholder features
- No subscription required
- Must set up Stripe Connect to receive tips

**Loqee Free Tier:**
- Cannot create a loq (subscription required)
- Can browse loqholders
- Can set up profile
- Shows "Subscribe to start your first loq"

**Loqee Premium (€5/month or €50/year):**
- Can create loq sessions
- Can send tips
- Full chat access
- All core features

---

## Feature Gating

```javascript
// Only loqees need subscription check
async function canCreateLoq(userId) {
  const profile = await getProfile(userId);
  if (profile.role === 'loqholder') return true; // always free
  return profile.subscription_status === 'active';
}
```

Enforce server-side on:
- `POST /api/loqs/create` → check before creating

---

## Stripe Checkout Flow

1. Loqee clicks "Subscribe"
2. `POST /api/subscription/checkout` → Stripe session URL
3. Redirect to Stripe Checkout
4. Payment → webhook → `subscription_status = 'active'`
5. Redirect back to dashboard

---

## Webhook Events

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Set `subscription_status = 'active'` |
| `customer.subscription.updated` | Update period dates |
| `invoice.payment_failed` | Set `subscription_status = 'inactive'` |
| `customer.subscription.deleted` | Set `subscription_status = 'inactive'` |

---

## Subscriptions Table

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  status TEXT CHECK (status IN ('active', 'inactive', 'past_due', 'canceled')) DEFAULT 'inactive',
  current_period_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Edge Cases

- Loqholder tries to subscribe → return "Loqholders use the platform for free"
- Webhook arrives late → idempotent handling
- Payment fails → 3-day grace period
- Cancel → downgrade on period end
