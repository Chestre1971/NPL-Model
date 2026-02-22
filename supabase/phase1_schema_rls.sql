-- Phase 1: Core schema + RLS for NPL Model classroom deployment
-- Run this in Supabase SQL Editor as project owner.

-- Recommended extensions
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) Profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  role text not null default 'student' check (role in ('student', 'instructor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Auto-create profile on auth signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2) Submissions
-- ---------------------------------------------------------------------------
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assignment_id text not null default 'npl_model_2026_q1',
  module_id text not null,
  question_id text not null,
  answer_text text,
  answer_numeric text,
  answer_payload jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, assignment_id, module_id, question_id)
);

create index if not exists idx_submissions_user on public.submissions(user_id);
create index if not exists idx_submissions_assignment on public.submissions(assignment_id);
create index if not exists idx_submissions_module on public.submissions(module_id);

drop trigger if exists trg_submissions_updated_at on public.submissions;
create trigger trg_submissions_updated_at
before update on public.submissions
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3) Scores (AI/manual grading outputs)
-- ---------------------------------------------------------------------------
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  grader_user_id uuid references auth.users(id) on delete set null,
  points_awarded numeric(5,2) not null check (points_awarded >= 0),
  points_max numeric(5,2) not null check (points_max > 0),
  rubric_level integer check (rubric_level between 0 and 3),
  feedback text,
  graded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id)
);

create index if not exists idx_scores_submission on public.scores(submission_id);

drop trigger if exists trg_scores_updated_at on public.scores;
create trigger trg_scores_updated_at
before update on public.scores
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4) Optional state snapshot table (full app state save/resume)
-- ---------------------------------------------------------------------------
create table if not exists public.student_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  assignment_id text not null default 'npl_model_2026_q1',
  state_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_states_assignment on public.student_states(assignment_id);

drop trigger if exists trg_student_states_updated_at on public.student_states;
create trigger trg_student_states_updated_at
before update on public.student_states
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5) Role helper
-- ---------------------------------------------------------------------------
create or replace function public.is_instructor(uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid and p.role = 'instructor'
  );
$$;

-- ---------------------------------------------------------------------------
-- 6) Enable Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.submissions enable row level security;
alter table public.scores enable row level security;
alter table public.student_states enable row level security;

-- ---------------------------------------------------------------------------
-- 7) Profiles policies
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_self_read_or_instructor" on public.profiles;
create policy "profiles_self_read_or_instructor"
on public.profiles
for select
to authenticated
using (
  id = auth.uid() or public.is_instructor(auth.uid())
);

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- No direct inserts/deletes by clients. Trigger handles insert.

-- ---------------------------------------------------------------------------
-- 8) Submissions policies
-- ---------------------------------------------------------------------------
drop policy if exists "submissions_student_read_own_or_instructor" on public.submissions;
create policy "submissions_student_read_own_or_instructor"
on public.submissions
for select
to authenticated
using (
  user_id = auth.uid() or public.is_instructor(auth.uid())
);

drop policy if exists "submissions_student_insert_own" on public.submissions;
create policy "submissions_student_insert_own"
on public.submissions
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "submissions_student_update_own_or_instructor" on public.submissions;
create policy "submissions_student_update_own_or_instructor"
on public.submissions
for update
to authenticated
using (
  user_id = auth.uid() or public.is_instructor(auth.uid())
)
with check (
  user_id = auth.uid() or public.is_instructor(auth.uid())
);

drop policy if exists "submissions_instructor_delete" on public.submissions;
create policy "submissions_instructor_delete"
on public.submissions
for delete
to authenticated
using (public.is_instructor(auth.uid()));

-- ---------------------------------------------------------------------------
-- 9) Scores policies
-- ---------------------------------------------------------------------------
drop policy if exists "scores_student_read_own_or_instructor" on public.scores;
create policy "scores_student_read_own_or_instructor"
on public.scores
for select
to authenticated
using (
  exists (
    select 1
    from public.submissions s
    where s.id = scores.submission_id
      and (s.user_id = auth.uid() or public.is_instructor(auth.uid()))
  )
);

drop policy if exists "scores_instructor_insert" on public.scores;
create policy "scores_instructor_insert"
on public.scores
for insert
to authenticated
with check (public.is_instructor(auth.uid()));

drop policy if exists "scores_instructor_update" on public.scores;
create policy "scores_instructor_update"
on public.scores
for update
to authenticated
using (public.is_instructor(auth.uid()))
with check (public.is_instructor(auth.uid()));

drop policy if exists "scores_instructor_delete" on public.scores;
create policy "scores_instructor_delete"
on public.scores
for delete
to authenticated
using (public.is_instructor(auth.uid()));

-- ---------------------------------------------------------------------------
-- 10) Student states policies
-- ---------------------------------------------------------------------------
drop policy if exists "student_states_read_own_or_instructor" on public.student_states;
create policy "student_states_read_own_or_instructor"
on public.student_states
for select
to authenticated
using (
  user_id = auth.uid() or public.is_instructor(auth.uid())
);

drop policy if exists "student_states_insert_own" on public.student_states;
create policy "student_states_insert_own"
on public.student_states
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "student_states_update_own_or_instructor" on public.student_states;
create policy "student_states_update_own_or_instructor"
on public.student_states
for update
to authenticated
using (
  user_id = auth.uid() or public.is_instructor(auth.uid())
)
with check (
  user_id = auth.uid() or public.is_instructor(auth.uid())
);

-- ---------------------------------------------------------------------------
-- 11) Helper: make a user instructor by email
-- Run this after that user has signed up once.
-- ---------------------------------------------------------------------------
create or replace function public.promote_to_instructor(target_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_uid uuid;
begin
  select u.id into target_uid
  from auth.users u
  where lower(u.email) = lower(target_email)
  limit 1;

  if target_uid is null then
    raise exception 'No auth user found for email: %', target_email;
  end if;

  insert into public.profiles (id, email, role)
  values (target_uid, target_email, 'instructor')
  on conflict (id) do update set role = 'instructor', email = excluded.email, updated_at = now();
end;
$$;

-- Example call (run manually when ready):
-- select public.promote_to_instructor('ced36@cornell.edu');
