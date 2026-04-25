-- Migration 010 — long-form deep research memo per item (Opus-generated)

alter table public.items
  add column if not exists deep_research text,
  add column if not exists deep_research_generated_at timestamptz;

create index if not exists idx_items_deep_research_present
  on public.items(user_id) where deep_research_generated_at is not null;
