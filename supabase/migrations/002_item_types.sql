-- Migration 002 — expand items table for full regimen (not just supplements)
-- Adds item_type (supplement | topical | device | procedure | practice | food | gear | test)
-- Adds seed_id so we can idempotently sync seed items without duplicating

alter table public.items
  add column if not exists item_type text default 'supplement',
  add column if not exists seed_id text;

create index if not exists idx_items_user_seed
  on public.items(user_id, seed_id);

-- Backfill item_type on any existing rows (all seeded so far were supplements)
update public.items
set item_type = 'supplement'
where item_type is null;
