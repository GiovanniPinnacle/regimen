-- Regimen — initial schema
-- Multi-tenant from day 1. Each user sees only their own rows via Row Level Security.
-- Run this in the Supabase SQL Editor.

-- =====================================================
-- 1. Extensions
-- =====================================================
create extension if not exists "uuid-ossp";

-- =====================================================
-- 2. Profiles (extends auth.users)
-- =====================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  postop_date date,
  goals text[] default '{}',
  hard_nos jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- Auto-create profile row on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =====================================================
-- 3. Items (the regimen library)
-- =====================================================
create table if not exists public.items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  brand text,
  dose text,
  unit text,
  timing_slot text not null,
  schedule_rule jsonb default '{"frequency":"daily"}'::jsonb,
  category text not null,
  goals text[] default '{}',
  started_on date,
  ends_on date,
  review_trigger text,
  status text default 'active',
  notes text,
  purchase_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_items_user_status on public.items(user_id, status);
create index if not exists idx_items_user_timing on public.items(user_id, timing_slot);

-- =====================================================
-- 4. Stack log (daily check-offs)
-- =====================================================
create table if not exists public.stack_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  item_id uuid not null references public.items(id) on delete cascade,
  taken boolean default true,
  skipped_reason text,
  logged_at timestamptz default now(),
  unique(user_id, date, item_id)
);
create index if not exists idx_stack_log_user_date on public.stack_log(user_id, date);

-- =====================================================
-- 5. Symptom log
-- =====================================================
create table if not exists public.symptom_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  feel_score int,
  sleep_quality int,
  seb_derm_score int,
  stress int,
  energy_pm int,
  notes text,
  logged_at timestamptz default now(),
  unique(user_id, date)
);

-- =====================================================
-- 6. Meal log (Claude vision food photos)
-- =====================================================
create table if not exists public.meal_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  meal_type text,
  photo_url text,
  claude_analysis_json jsonb,
  trigger_flags text[] default '{}',
  notes text,
  logged_at timestamptz default now()
);

-- =====================================================
-- 7. Scalp photos
-- =====================================================
create table if not exists public.scalp_photos (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  photo_url text not null,
  region text,
  lighting_note text,
  claude_analysis_json jsonb,
  logged_at timestamptz default now()
);

-- =====================================================
-- 8. Data imports (Oura CSV, bloodwork PDFs, etc.)
-- =====================================================
create table if not exists public.data_imports (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  source_type text not null,
  file_url text,
  parsed_json jsonb,
  date_range_start date,
  date_range_end date,
  created_at timestamptz default now()
);

-- =====================================================
-- 9. Oura daily
-- =====================================================
create table if not exists public.oura_daily (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  readiness int,
  hrv int,
  rhr int,
  deep_sleep_min int,
  rem_sleep_min int,
  total_sleep_min int,
  temp_deviation numeric,
  unique(user_id, date)
);

-- =====================================================
-- 10. CGM readings (Stelo / Dexcom)
-- =====================================================
create table if not exists public.cgm_readings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ts timestamptz not null,
  glucose int not null,
  sensor_id text
);
create index if not exists idx_cgm_user_ts on public.cgm_readings(user_id, ts desc);

-- =====================================================
-- 11. Insights (AI-generated observations)
-- =====================================================
create table if not exists public.insights (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  type text,
  title text,
  body text,
  confidence text,
  source_data_ids uuid[],
  status text default 'new',
  user_action text
);

-- =====================================================
-- 12. Reviews (scheduled checkpoints)
-- =====================================================
create table if not exists public.reviews (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_date date not null,
  phase_name text not null,
  status text default 'upcoming',
  decisions_json jsonb,
  claude_analysis text,
  completed_at timestamptz
);

-- =====================================================
-- 13. Changelog
-- =====================================================
create table if not exists public.changelog (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  change_type text not null,
  item_id uuid references public.items(id) on delete set null,
  item_name text,
  reasoning text,
  triggered_by text,
  approved_by_user boolean default true,
  created_at timestamptz default now()
);

-- =====================================================
-- 14. Claude conversations
-- =====================================================
create table if not exists public.claude_conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  context_json jsonb,
  messages_json jsonb,
  related_item_id uuid references public.items(id) on delete set null
);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.stack_log enable row level security;
alter table public.symptom_log enable row level security;
alter table public.meal_log enable row level security;
alter table public.scalp_photos enable row level security;
alter table public.data_imports enable row level security;
alter table public.oura_daily enable row level security;
alter table public.cgm_readings enable row level security;
alter table public.insights enable row level security;
alter table public.reviews enable row level security;
alter table public.changelog enable row level security;
alter table public.claude_conversations enable row level security;

-- Profiles: user sees/updates only their own
create policy "own profile read" on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- Generic owner policies for every other table
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'items','stack_log','symptom_log','meal_log','scalp_photos',
      'data_imports','oura_daily','cgm_readings','insights',
      'reviews','changelog','claude_conversations'
    ])
  loop
    execute format('create policy "own %s read" on public.%I for select using (auth.uid() = user_id);', t, t);
    execute format('create policy "own %s insert" on public.%I for insert with check (auth.uid() = user_id);', t, t);
    execute format('create policy "own %s update" on public.%I for update using (auth.uid() = user_id);', t, t);
    execute format('create policy "own %s delete" on public.%I for delete using (auth.uid() = user_id);', t, t);
  end loop;
end $$;

-- =====================================================
-- STORAGE BUCKETS (for photo uploads)
-- =====================================================
insert into storage.buckets (id, name, public)
values
  ('meal-photos', 'meal-photos', false),
  ('scalp-photos', 'scalp-photos', false),
  ('supplement-photos', 'supplement-photos', false)
on conflict (id) do nothing;

-- Storage RLS: users can upload/read only their own folder
create policy "users upload own meal photos"
  on storage.objects for insert
  with check (
    bucket_id = 'meal-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "users read own meal photos"
  on storage.objects for select
  using (
    bucket_id = 'meal-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users upload own scalp photos"
  on storage.objects for insert
  with check (
    bucket_id = 'scalp-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "users read own scalp photos"
  on storage.objects for select
  using (
    bucket_id = 'scalp-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users upload own supplement photos"
  on storage.objects for insert
  with check (
    bucket_id = 'supplement-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "users read own supplement photos"
  on storage.objects for select
  using (
    bucket_id = 'supplement-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
