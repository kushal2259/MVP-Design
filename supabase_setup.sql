-- ============================================================================
--  ArchCopilot / MVP Design — Supabase Database Setup
--  Run this entire script in your Supabase project:
--    Dashboard → SQL Editor → New query → paste → Run
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROJECTS TABLE
--    Stores the full Project object as JSONB so the schema can evolve freely.
-- ----------------------------------------------------------------------------
create table if not exists public.projects (
  id          text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  status      text,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists projects_created_at_idx on public.projects (created_at desc);

-- ----------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY
--    Each authenticated user can only read/write their OWN projects.
-- ----------------------------------------------------------------------------
alter table public.projects enable row level security;

drop policy if exists "Users can view own projects"   on public.projects;
drop policy if exists "Users can insert own projects" on public.projects;
drop policy if exists "Users can update own projects" on public.projects;
drop policy if exists "Users can delete own projects" on public.projects;

create policy "Users can view own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "Users can insert own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update own projects"
  on public.projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 3. AUTO-UPDATE updated_at ON EVERY WRITE
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. SITE VISITS  (one row per project, holding the visit array as JSONB)
-- ----------------------------------------------------------------------------
create table if not exists public.project_visits (
  project_id  text not null,
  user_id     uuid not null references auth.users (id) on delete cascade,
  data        jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (project_id, user_id)
);

alter table public.project_visits enable row level security;

drop policy if exists "Users manage own visits" on public.project_visits;
create policy "Users manage own visits"
  on public.project_visits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
--  DONE.
--
--  OPTIONAL but recommended for instant signup (no email round-trip):
--    Dashboard → Authentication → Sign In / Providers → Email
--      → turn OFF "Confirm email"
--    This lets new users sign in immediately after registering.
--    (If you leave it ON, users must click a confirmation link first.)
-- ============================================================================
