-- Unified intake log — meals, snacks, water, beverages, all stored as
-- timestamped rows with optional macros and photo. Lazy tracking:
-- user taps water/photo/voice/text, we extract macros via Claude, store
-- here, running daily totals derived in app.
--
-- Why one table for everything: water and food share the same "what did
-- you put in your body today" mental model. Querying for daily totals is
-- trivial; we sum across kinds.

create table if not exists intake_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  logged_at timestamptz not null default now(),
  date date not null default current_date,
  kind text not null check (kind in ('meal', 'snack', 'water', 'beverage')),
  /** Free-form description: "eggs + avocado", "16oz water", "americano" */
  content text not null,
  photo_url text,
  serving text,
  /** Macros — nullable; water/black coffee = 0; estimated by Claude when analyzed. */
  calories integer,
  protein_g numeric(5,1),
  fat_g numeric(5,1),
  carbs_g numeric(5,1),
  /** Hydration in fluid oz (water + beverages). null for meals/snacks. */
  water_oz numeric(5,1),
  /** Source of analysis: 'claude_vision', 'claude_voice', 'claude_text', 'manual', 'quick_water' */
  analyzed_by text,
  notes text,
  created_at timestamptz not null default now()
);

alter table intake_log enable row level security;

drop policy if exists "Users manage their own intake" on intake_log;
create policy "Users manage their own intake" on intake_log
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists intake_log_user_date_idx
  on intake_log(user_id, date desc);
create index if not exists intake_log_date_kind_idx
  on intake_log(date, kind);

-- Optional daily water target stored on profile
alter table profiles
  add column if not exists water_target_oz integer default 84;

comment on column intake_log.water_oz is 'Fluid ounces of hydrating liquid. Water = full count. Coffee/tea typically 50-75% effective hydration but stored at face value.';
comment on column profiles.water_target_oz is 'Daily water target in oz. Default 84 oz (~2.5L). User can override.';
