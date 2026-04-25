-- Migration 009 — auto-generated per-item research + integration notes

alter table public.items
  add column if not exists usage_notes text,        -- short integration note (1-3 sentences or 2-5 steps)
  add column if not exists research_summary text,   -- longer mechanism + dosing + interactions
  add column if not exists research_generated_at timestamptz;

create index if not exists idx_items_research_missing
  on public.items(user_id) where research_generated_at is null;
