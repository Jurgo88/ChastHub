# 09 – Testing Guide

## Priority Areas (Must Test)

1. Lock system logic (expiration, timezone)
2. Pairing flow (invite, accept, end)
3. Stripe webhook handling
4. RLS policies (user cannot access another user's data)
5. Auth (rate limiting, banned user)

---

## Unit Tests (Vitest)

```javascript
// tests/unit/lock.spec.ts

describe('Lock System', () => {
  it('detects expired lock correctly', () => {
    const lock = { locked_until: new Date(Date.now() - 1000).toISOString() };
    expect(getLockStatus(lock).locked).toBe(false);
  });

  it('detects active lock correctly', () => {
    const lock = { locked_until: new Date(Date.now() + 3600000).toISOString() };
    expect(getLockStatus(lock).locked).toBe(true);
  });

  it('rejects duration below 1 minute', () => {
    expect(() => validateDuration(30_000)).toThrow();
  });

  it('rejects duration above 7 days', () => {
    expect(() => validateDuration(8 * 24 * 60 * 60 * 1000)).toThrow();
  });

  it('converts UTC to local timezone for display', () => {
    const utc = new Date('2024-04-30T16:00:00Z');
    const local = convertToLocalDisplay(utc, 'Europe/Bratislava'); // UTC+2
    expect(local).toContain('18:00');
  });
});
```

---

## Integration Tests

```javascript
describe('Pairing Flow', () => {
  it('keyholder creates invite, lockee joins, keyholder confirms', async () => {
    const invite = await api.post('/api/relationships/invite');
    const code = invite.invite_code;

    const join = await api.post(`/api/relationships/join/${code}`, {}, { lockeeToken });
    expect(join.status).toBe('pending');

    const confirm = await api.post(`/api/relationships/${join.relationship_id}/confirm`);
    expect(confirm.status).toBe('active');
  });
});

describe('Stripe Webhook', () => {
  it('activates subscription on checkout.session.completed', async () => {
    await processWebhook({ type: 'checkout.session.completed', data: mockSession });
    const profile = await getProfile(userId);
    expect(profile.subscription_status).toBe('active');
  });
});
```

---

## Manual QA Checklist

```
AUTH:
  [ ] Signup with valid credentials works
  [ ] Signup with existing email shows error
  [ ] Weak password rejected with message
  [ ] Login works
  [ ] Logout clears session
  [ ] Banned user cannot login
  [ ] Rate limit triggers after 5 failed attempts

PAIRING:
  [ ] Keyholder generates invite code
  [ ] Lockee joins with code
  [ ] Keyholder confirms pairing
  [ ] Both see "Pairing active"
  [ ] Expired code shows error
  [ ] Cannot pair with yourself

LOCK SYSTEM:
  [ ] Set lock for 1 hour → countdown shows
  [ ] Countdown is accurate (within 3 seconds)
  [ ] Correct time shown in local timezone
  [ ] Lock expires → shows "Unlocked" automatically
  [ ] Change lock → countdown updates
  [ ] Remove lock → shows "Unlocked"
  [ ] Go offline while locked → reconnect shows correct state

MESSAGING:
  [ ] Send message appears in chat
  [ ] Other user sees message in <1s
  [ ] Cannot send after relationship ends
  [ ] 5001 char message rejected

SUBSCRIPTION:
  [ ] Free user blocked from 2nd pairing
  [ ] Stripe checkout opens
  [ ] After payment → subscription active
  [ ] Canceled → downgraded to free

ADMIN:
  [ ] Admin sees all users
  [ ] Admin can view messages in any relationship
  [ ] Admin bans user → user cannot login
  [ ] Ban clears locks and ends relationships

SECURITY:
  [ ] User A cannot see User B's messages
  [ ] User A cannot set locks on User B's relationship
  [ ] Non-admin cannot access /admin
```
