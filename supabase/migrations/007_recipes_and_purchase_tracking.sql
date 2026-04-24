-- Migration 007 — recipes + item purchase lifecycle tracking

-- =====================================================
-- 1. Recipes
-- =====================================================
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  source text default 'user', -- 'user' | 'claude'
  servings int default 1,
  calories_per_serving int,
  protein_g int,
  fat_g int,
  carbs_g int,
  ingredients jsonb default '[]'::jsonb, -- [{name, amount, notes?}]
  instructions text,
  tags text[] default '{}',
  goals text[] default '{}',
  is_favorite boolean default false,
  times_made int default 0,
  last_made date,
  fridge_snapshot text, -- for Claude-generated: what was in the fridge
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_recipes_user on public.recipes(user_id, created_at desc);
create index if not exists idx_recipes_favorite on public.recipes(user_id, is_favorite);

alter table public.recipes enable row level security;
create policy "own recipes read" on public.recipes
  for select using (auth.uid() = user_id);
create policy "own recipes insert" on public.recipes
  for insert with check (auth.uid() = user_id);
create policy "own recipes update" on public.recipes
  for update using (auth.uid() = user_id);
create policy "own recipes delete" on public.recipes
  for delete using (auth.uid() = user_id);

-- =====================================================
-- 2. Item purchase lifecycle
-- =====================================================
-- States: null (unaudited) | 'needed' | 'ordered' | 'shipped' | 'arrived' | 'using' | 'depleted'
alter table public.items
  add column if not exists purchase_state text,
  add column if not exists ordered_on date,
  add column if not exists arrived_on date,
  add column if not exists days_supply int, -- how many days one unit lasts
  add column if not exists reorder_alert_sent_at timestamptz;

create index if not exists idx_items_purchase_state
  on public.items(user_id, purchase_state);

-- Backfill purchase_state from legacy owned flag
update public.items
set purchase_state = case
  when owned is true then 'using'
  when owned is false then 'needed'
  else null
end
where purchase_state is null;
