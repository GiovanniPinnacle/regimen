-- Migration 011 — sort_order for intentional Today ordering within timing slots

alter table public.items
  add column if not exists sort_order int;

create index if not exists idx_items_sort_order
  on public.items(user_id, timing_slot, sort_order);
