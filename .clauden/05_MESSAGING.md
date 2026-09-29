# 05 – Messaging + Tipping

## Messaging Constraints

- Text-only (no images, files – Phase 2)
- Max 5000 characters per message
- Messages are immutable (no edit/delete in MVP)
- Rate limit: max 20 messages per minute per user
- Chat available between any paired users

---

## Sending Rules

- Both Loqholder and Loqee can send anytime
- Loqee can send even while loqed
- Cannot send after relationship ends → 403

---

## Tipping System

### How it works:
- Loqee sends a tip to Loqholder
- Loqee pays: tip amount + 10% platform commission
- Loqholder receives: 100% of tip amount
- Platform keeps: 10% commission

### Tip locations:
- In chat (tip button next to message input)
- On Loqholder's public profile page

### Tip flow:
1. Loqee clicks "Tip" button
2. Enters amount (min: €1)
3. Stripe Checkout opens
4. Payment processed via Stripe Connect
5. Loqholder receives payout to their Stripe Connect account
6. Tip message appears in chat: "💸 [Loqee] sent a €X tip!"

### Stripe Connect (Phase 1 - basic):
- Loqholder creates Stripe Connect Express account
- Platform routes payments via Stripe Connect
- Payouts handled by Stripe automatically

---

## Database

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 5000),
  message_type TEXT CHECK (message_type IN ('text', 'tip')) DEFAULT 'text',
  tip_amount NUMERIC,  -- populated for tip messages
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES profiles(id),
  to_user_id UUID NOT NULL REFERENCES profiles(id),
  amount NUMERIC NOT NULL,
  platform_fee NUMERIC NOT NULL,  -- 10% of amount
  stripe_payment_intent_id TEXT UNIQUE,
  status TEXT CHECK (status IN ('pending', 'completed', 'failed')) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## RLS Policies

```sql
-- Users in relationship can see messages
CREATE POLICY "See own messages"
  ON messages FOR SELECT
  USING (
    relationship_id IN (
      SELECT id FROM relationships
      WHERE loqee_id = auth.uid() OR loqholder_id = auth.uid()
    )
  );

-- Users in relationship can send
CREATE POLICY "Send own messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    relationship_id IN (
      SELECT id FROM relationships
      WHERE loqee_id = auth.uid() OR loqholder_id = auth.uid()
    )
  );

-- Admin can see ALL messages
CREATE POLICY "Admin reads all messages"
  ON messages FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Users can see their own tips
CREATE POLICY "See own tips"
  ON tips FOR SELECT
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());
```

---

## Edge Cases

- Tip < €1 → reject with validation error
- Loqholder has no Stripe Connect account → show "Set up payments first"
- Send after relationship ends → 403
- Message > 5000 chars → 400
