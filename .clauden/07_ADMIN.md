# 07 – Admin Panel

## Access Control

- Only users with `profiles.role = 'admin'` can access `/admin`
- Protected via Nuxt middleware (`middleware/admin.ts`)
- Admin cannot modify locks or participate in relationships

---

## Pages

### /admin/users
- List all users
- Columns: Email, Role, Subscription, Status, Created
- Search by email
- Action: View Details, Ban User

### /admin/relationships
- List all relationships
- Columns: Keyholder, Lockee, Status, Created
- Filter: pending | active | ended

### /admin/messages
- View messages per relationship (for moderation)
- Admin can browse any conversation
- Read-only, no reply option
- Used to evaluate inappropriate behavior before issuing ban
- Show: sender, content, timestamp

### /admin/reports
- List all submitted reports
- Columns: Reported User, Reported By, Reason, Date, Status
- Actions: Dismiss, Ban User
- Report status: open | dismissed | resolved

---

## Ban User

When admin bans a user:
```
1. profiles.status = 'banned'
2. User cannot login (checked in auth middleware)
3. All their active relationships → status = 'ended'
4. All their active locks → locked = false
5. Audit log entry created
6. Optional: show "Account suspended" on next login attempt
```

---

## Reports Table

```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_by_id UUID NOT NULL REFERENCES profiles(id),
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('open', 'dismissed', 'resolved')) DEFAULT 'open',
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);
```

---

## How Users Submit Reports

- Button in chat or relationship view: "Report User"
- Form: reason (dropdown) + optional description
- Reasons: "Abusive behavior", "Harassment", "Inappropriate content", "Other"
- `POST /api/reports` → inserts report, visible to admin immediately

---

## RLS Policies

```sql
-- Users can submit reports
CREATE POLICY "Users can submit reports"
  ON reports FOR INSERT
  WITH CHECK (reported_by_id = auth.uid());

-- Only admin can read reports
CREATE POLICY "Admin reads reports"
  ON reports FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Only admin can update (dismiss, resolve)
CREATE POLICY "Admin updates reports"
  ON reports FOR UPDATE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
```

---

## Audit Log (Optional but Recommended)

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,   -- e.g., 'user_banned', 'report_resolved'
  actor_id UUID REFERENCES profiles(id),
  target_id UUID REFERENCES profiles(id),
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```
