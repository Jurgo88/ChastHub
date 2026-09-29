# 01 – Authentication & User Profiles

## Auth Flow (Supabase Auth)

**Signup options:**
- Email + password
- Google OAuth (via Supabase)

**Email Signup:**
1. User provides: email, password
2. Validate: 8+ chars, uppercase, lowercase, number
3. Supabase creates user in auth.users
4. Create matching record in profiles table
5. Show role selection: "I am a Loqholder / Loqee"
6. Store role in profiles.role
7. Auto-login, redirect to dashboard

**Google OAuth:**
1. User clicks "Sign up with Google"
2. Supabase handles OAuth flow
3. On first login: show role selection modal
4. Store role, redirect to dashboard

**Login:**
- Email + password OR Google via Supabase Auth
- JWT stored securely (httpOnly cookie via Nuxt)
- Session persists on page refresh

**Password Reset:**
- Only for email accounts
- Supabase sends reset email
- User sets new password, old sessions invalidated

**Logout:**
- Clear session, clear Pinia stores, redirect to /auth/login

**Rate Limiting:**
- Max 5 failed logins per 15 minutes per IP
- Max 3 password resets per hour per email

---

## Profiles Table

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('loqee', 'loqholder', 'admin')) NOT NULL,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  subscription_status TEXT CHECK (subscription_status IN ('inactive', 'active')) DEFAULT 'inactive',
  status TEXT CHECK (status IN ('active', 'banned')) DEFAULT 'active',
  stripe_account_id TEXT,  -- For loqholder Stripe Connect
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Note:** Profile is created immediately after Supabase Auth signup via a database trigger or server route.

---

## RLS Policies

```sql
-- Users can see their own profile
CREATE POLICY "Own profile read"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Own profile update"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Anyone can see basic public profile info (for leaderboard/pairing)
CREATE POLICY "Public profile read"
  ON profiles FOR SELECT
  USING (status = 'active');

-- Admin can see all profiles
CREATE POLICY "Admin reads all profiles"
  ON profiles FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
```

---

## Edge Cases

- Duplicate email → "Email already in use"
- Weak password → specific validation message
- Profile creation fails after signup → retry once, log error
- Banned user tries to login → "Account suspended"
- Google user tries password reset → "Use Google to sign in"
