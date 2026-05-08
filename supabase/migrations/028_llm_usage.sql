-- Migration 028 — LLM usage tracking + rate limiting.
--
-- Why: every Anthropic-backed route (Coach chat, deep research,
-- bloodwork vision, catalog generate, affiliate discover, etc.)
-- currently has zero per-user rate limiting. A single user with a
-- script can rack up 4-figure token bills in an afternoon. This table
-- + the helpers in src/lib/rate-limit.ts close that hole.
--
-- Data model: append-only log of LLM calls. The rate limiter counts
-- rows in the last 24h matching (user_id, bucket) and rejects when
-- count >= the per-bucket cap.
--
-- Buckets (string enum, not constrained at the DB layer for forward
-- compatibility):
--   - "coach"     — Coach chat / ask / refine / voice-memo
--   - "research"  — deep-research, research-bulk
--   - "vision"    — bloodwork-parse, photo analyze
--   - "enrich"    — items/enrich, catalog/generate, catalog/enrich,
--                   affiliates/discover
--   - "digest"    — weekly-digest, symptom-correlations
--
-- Caps (set in src/lib/rate-limit.ts, not hard-coded here):
--   - coach    100/24h
--   - research   5/24h
--   - vision    10/24h
--   - enrich    50/24h
--   - digest     5/24h

create table if not exists public.llm_usage (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  route text not null,            -- "/api/items/enrich", etc.
  model text,                     -- "claude-sonnet-4-5-20250929", etc.
  tokens_in int,
  tokens_out int,
  cost_cents numeric(10, 4),      -- best-effort estimate, may be null
  created_at timestamptz not null default now()
);

create index if not exists idx_llm_usage_user_bucket_recent
  on public.llm_usage (user_id, bucket, created_at desc);

create index if not exists idx_llm_usage_user_recent
  on public.llm_usage (user_id, created_at desc);

-- RLS — users can read their own usage rows (so the UI can show
-- "you've used 3 of 5 deep research calls today"). All writes go
-- through the service-role admin client from rate-limit.ts.
alter table public.llm_usage enable row level security;

create policy "users read own llm usage"
  on public.llm_usage
  for select
  using (auth.uid() = user_id);

comment on table public.llm_usage is
  'Append-only log of every Anthropic call. Used by rate-limit.ts to enforce per-bucket per-24h caps. Also useful for cost analysis and per-user usage display.';
