-- Migration 008 — item unit cost + standalone wishlist

-- Item unit cost (per bottle / unit purchased). Combined with days_supply,
-- the app computes monthly run-rate cost.
alter table public.items
  add column if not exists unit_cost numeric;

create index if not exists idx_items_user_cost
  on public.items(user_id) where unit_cost is not null;

-- Lightweight wishlist — things you might buy but haven't committed to
-- adding to the regimen. Decoupled from items so quick-add stays frictionless.
create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  url text,
  est_cost numeric,
  category text, -- 'supplement' | 'gear' | 'food' | 'topical' | 'service' | 'book' | 'other'
  notes text,
  priority text default 'medium', -- 'low' | 'medium' | 'high'
  promoted_to_item_id uuid references public.items(id) on delete set null,
  promoted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_wishlist_user
  on public.wishlist_items(user_id, created_at desc);
create index if not exists idx_wishlist_priority
  on public.wishlist_items(user_id, priority);

alter table public.wishlist_items enable row level security;
create policy "own wishlist read" on public.wishlist_items
  for select using (auth.uid() = user_id);
create policy "own wishlist insert" on public.wishlist_items
  for insert with check (auth.uid() = user_id);
create policy "own wishlist update" on public.wishlist_items
  for update using (auth.uid() = user_id);
create policy "own wishlist delete" on public.wishlist_items
  for delete using (auth.uid() = user_id);
