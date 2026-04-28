-- Achievements / badges. Pure unlock log — registry of which achievements
-- the user has earned, and when. The catalog of available achievements
-- lives in code (src/lib/achievements.ts) so we can add new ones without
-- touching the DB.

create table if not exists achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  /** Stable key matching an entry in the code-side ACHIEVEMENTS catalog. */
  achievement_key text not null,
  unlocked_at timestamptz not null default now(),
  /** Optional: snapshot of the metric value at unlock time (for trophy details). */
  metric_value numeric,
  unique(user_id, achievement_key)
);

alter table achievements enable row level security;

drop policy if exists "Users see their own achievements" on achievements;
create policy "Users see their own achievements" on achievements
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists achievements_user_unlocked_idx
  on achievements(user_id, unlocked_at desc);
