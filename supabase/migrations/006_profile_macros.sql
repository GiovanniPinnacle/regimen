-- Migration 006 — profile body composition + goals for portion calculator

alter table public.profiles
  add column if not exists weight_kg numeric,
  add column if not exists height_cm numeric,
  add column if not exists age int,
  add column if not exists biological_sex text, -- 'male' | 'female'
  add column if not exists activity_level text default 'moderate', -- sedentary|light|moderate|very_active|extra
  add column if not exists body_goal text default 'maintain', -- lean|maintain|build
  add column if not exists meals_per_day int default 3;

-- For companion items: link a "companion" item (cinnamon, MCT, electrolytes)
-- to a parent (e.g. morning coffee) so the UI can group them.
alter table public.items
  add column if not exists companion_of uuid references public.items(id) on delete set null,
  add column if not exists companion_instruction text;
create index if not exists idx_items_companion_of
  on public.items(user_id, companion_of);
