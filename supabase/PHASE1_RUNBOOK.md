# Phase 1 Runbook (Supabase + Vercel)

This project currently runs in-browser with `localStorage`. This runbook sets up the backend data layer for:
- login/auth accounts,
- per-student submissions,
- grading records,
- instructor visibility.

## 1) Run schema and RLS script

1. Open Supabase project dashboard.
2. Go to `SQL Editor`.
3. Create a new query.
4. Paste the file `supabase/phase1_schema_rls.sql`.
5. Run it.

Expected result:
- tables: `profiles`, `submissions`, `scores`, `student_states`
- RLS enabled on all four tables
- policies created
- helper functions created

## 2) Auth settings

1. Go to `Authentication` -> `Providers` -> `Email`.
2. Enable Email + Password.
3. Optional but recommended for class control: disable open public signups and create users from roster.

## 3) Create instructor account

1. Sign up once in your app using `ced36@cornell.edu` (or create user in Supabase Auth).
2. In SQL Editor, run:

```sql
select public.promote_to_instructor('ced36@cornell.edu');
```

3. Verify:

```sql
select id, email, role
from public.profiles
where lower(email) = 'ced36@cornell.edu';
```

Expected: `role = instructor`.

## 4) Verify RLS behavior

Minimum checks:
- Student A can only see/update Student A rows in `submissions` and `student_states`.
- Student B cannot see Student A rows.
- Instructor can read all rows and write scores.

## 5) Roster onboarding (40 students)

Recommended CSV columns:
- `email`
- `full_name`
- `role` (all `student`)

Create Auth users first, then upsert profiles for names:

```sql
-- Example per-user profile name update after user exists
update public.profiles
set full_name = 'Jane Smith'
where lower(email) = 'jane@cornell.edu';
```

If you want full bulk import automation, use Supabase Auth Admin API from a one-time script with the service role key (server-side only).

## 6) Security note

- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend (`VITE_*`) variables.
- Frontend should only use:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

## 7) Next implementation step in app code

After this DB setup, update app code to:
- use Supabase auth session instead of local login fields only,
- persist answers to `submissions`,
- persist full save state to `student_states`,
- read admin dashboard from DB instead of localStorage.
