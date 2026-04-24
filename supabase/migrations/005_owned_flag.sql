-- Migration 005 — track ownership for each item
-- owned: null = not yet audited, true = have it, false = need to order

alter table public.items
  add column if not exists owned boolean default null;

create index if not exists idx_items_user_owned
  on public.items(user_id, owned);
