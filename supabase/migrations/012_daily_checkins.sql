-- Migration 012 — daily check-ins per time checkin_window
-- Captures the data Regimen wants Claude to have: what you ate, did you train,
-- mood/energy/stress, why you skipped — broken into the day's natural checkin_windows.

create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  checkin_window text not null, -- 'morning' | 'breakfast' | 'workout' | 'lunch' | 'dinner' | 'general' | 'bedtime'
  meal_text text,        -- "what did you eat / drink"
  workout_text text,     -- "did you train? sets/RPE/notes"
  mood int,              -- 1-5
  energy int,            -- 1-5
  stress int,            -- 1-5
  notes text,
  data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, date, checkin_window)
);
create index if not exists idx_daily_checkins_user_date
  on public.daily_checkins(user_id, date desc);

alter table public.daily_checkins enable row level security;
create policy "own checkins read" on public.daily_checkins
  for select using (auth.uid() = user_id);
create policy "own checkins insert" on public.daily_checkins
  for insert with check (auth.uid() = user_id);
create policy "own checkins update" on public.daily_checkins
  for update using (auth.uid() = user_id);
create policy "own checkins delete" on public.daily_checkins
  for delete using (auth.uid() = user_id);
