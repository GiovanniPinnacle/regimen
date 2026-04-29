-- =============================================================
-- Combined Regimen migrations 014 → 023
-- Generated 2026-04-29 — paste into Supabase SQL editor and Run.
-- Each section is a separate migration file concatenated in order.
-- All operations are idempotent (use IF NOT EXISTS / ALTER ADD COLUMN
-- IF NOT EXISTS) so re-running is safe.
-- =============================================================


-- ============================
-- 014_affiliate_fields.sql
-- ============================
-- Affiliate-link primitive on items.
-- The "Get this" button on item detail uses these fields to drive
-- vendor links + price display + (later) cashback tracking for Pro users.
-- Refinement-first contract: affiliates do NOT influence what Claude
-- recommends. They're metadata on already-recommended items.

alter table items
  add column if not exists vendor text,
  add column if not exists affiliate_url text,
  add column if not exists list_price_cents integer,
  add column if not exists vendor_sku text;

comment on column items.vendor is 'Vendor name (e.g., "Amazon", "iHerb", "Thorne") — null if not commercially available';
comment on column items.affiliate_url is 'Tracked affiliate URL; null = no link';
comment on column items.list_price_cents is 'Last-known price in cents for display only';
comment on column items.vendor_sku is 'Vendor SKU/ASIN for matching across price/availability checks';


-- ============================
-- 015_protocols.sql
-- ============================
-- Protocols — prebuilt, expert-authored regimens that users enroll in.
-- The protocol definitions themselves live in code (src/lib/protocols/*.ts)
-- so they ship with the app, are version-controlled, and load without a DB call.
-- This migration adds:
--   1. protocol_enrollments — which user enrolled in which protocol, when
--   2. items.from_protocol_slug + from_protocol_item_key — track which items
--      came from which protocol so we can render protocol context
--      and unenroll cleanly later.

create table if not exists protocol_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  protocol_slug text not null,
  enrolled_at timestamptz not null default now(),
  start_date date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'paused', 'cancelled')),
  unique(user_id, protocol_slug)
);

alter table items
  add column if not exists from_protocol_slug text,
  add column if not exists from_protocol_item_key text;

alter table protocol_enrollments enable row level security;

drop policy if exists "Users manage their own enrollments" on protocol_enrollments;
create policy "Users manage their own enrollments" on protocol_enrollments
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists protocol_enrollments_user_idx
  on protocol_enrollments(user_id);
create index if not exists items_protocol_idx
  on items(from_protocol_slug)
  where from_protocol_slug is not null;


-- ============================
-- 016_item_reactions.sql
-- ============================
-- Item reactions — RP-Hypertrophy-style stimulus/fatigue tag, applied to
-- supplements/practices. Once an item has been active 7+ days (or its
-- research-backed time-to-effect window has elapsed), the user can rate
-- it: helped / no_change / worse / forgot.
--
-- This is the rich signal Claude needs for refinement. yes/no checkoffs
-- are too thin — the user "took it" but did it earn its spot? This is the
-- answer.
--
-- One reaction per item per day. The most recent N reactions inform the
-- "drop this" recommendations.

create table if not exists item_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  item_id uuid not null references items on delete cascade,
  reaction text not null check (reaction in ('helped', 'no_change', 'worse', 'forgot')),
  reacted_on date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  unique(user_id, item_id, reacted_on)
);

alter table item_reactions enable row level security;

drop policy if exists "Users manage their own reactions" on item_reactions;
create policy "Users manage their own reactions" on item_reactions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists item_reactions_user_item_idx
  on item_reactions(user_id, item_id);
create index if not exists item_reactions_recent_idx
  on item_reactions(user_id, reacted_on desc);


-- ============================
-- 017_voice_memos.sql
-- ============================
-- Voice memos — the "vent and let it process" capture surface.
-- User taps a button, dictates 10-60 seconds via Web Speech API
-- (browser-native, free), transcript is saved here. Claude reads recent
-- memos as context on next refinement run; can also extract structured
-- updates (skip a thing, swap a thing, add a note to an item).
--
-- Audio is NOT stored — too expensive, transcript is what's actionable.

create table if not exists voice_memos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  transcript text not null,
  /** Optional: linked to a specific item if user dictated from item detail. */
  item_id uuid references items on delete set null,
  /** Free-form context tag set by the UI: "vent", "log", "swap", "note", etc. */
  context_tag text,
  /** Claude's extracted structured action (if any). JSON. */
  extracted jsonb,
  duration_seconds int,
  created_at timestamptz not null default now()
);

alter table voice_memos enable row level security;

drop policy if exists "Users manage their own voice memos" on voice_memos;
create policy "Users manage their own voice memos" on voice_memos
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists voice_memos_user_recent_idx
  on voice_memos(user_id, created_at desc);
create index if not exists voice_memos_item_idx
  on voice_memos(item_id)
  where item_id is not null;


-- ============================
-- 018_intake_log.sql
-- ============================
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


-- ============================
-- 019_per_user_hard_nos.sql
-- ============================
-- Per-user hard NOs. Was a global hardcoded list (Giovanni's banned items
-- — Hairpower biotin, ashwagandha standalone, Cosmedica shampoo, etc.).
-- Now stored as JSONB on profiles so each user owns their list.
--
-- Shape: array of { name: string, category: string, reason?: string }
-- Categories: 'pharmaceutical' | 'food' | 'supplement' | 'product' | 'test' | 'approach'

alter table profiles
  add column if not exists hard_nos jsonb default '[]'::jsonb;

comment on column profiles.hard_nos is 'Per-user hard NOs — items the user wants Claude to never recommend. Edited via /hard-nos.';


-- ============================
-- 020_achievements.sql
-- ============================
-- Achievements / badges. Pure unlock log — registry of which achievements
-- the user has earned, and when. The catalog of available achievements
-- lives in code (src/lib/achievements.ts) so we can add new ones without
-- touching the DB.

create table if not exists achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  /** Stable key matching an entry in the code-side ACHIEVEMENTS catalog. */
  achievement_key text not null,
  unlocked_at timestamptz not null default now(),
  /** Optional: snapshot of the metric value at unlock time (for trophy details). */
  metric_value numeric,
  unique(user_id, achievement_key)
);

alter table achievements enable row level security;

drop policy if exists "Users see their own achievements" on achievements;
create policy "Users see their own achievements" on achievements
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists achievements_user_unlocked_idx
  on achievements(user_id, unlocked_at desc);


-- ============================
-- 021_monetization.sql
-- ============================
-- Migration 021 — Monetization architecture.
-- Goal: every item Coach surfaces (whether from a protocol, a manual add,
-- or a Coach proposal) becomes a revenue opportunity automatically. Click
-- tracking + auto-discovery status + commission metadata.

-- 1. Extend items table with affiliate-discovery + commission metadata
alter table items
  add column if not exists affiliate_network text,
  add column if not exists commission_rate numeric(5, 2),
  add column if not exists affiliate_lookup_attempted_at timestamptz,
  add column if not exists affiliate_lookup_status text default 'pending';

comment on column items.affiliate_network is 'Network identifier: amazon | iherb | thorne | manufacturer | other';
comment on column items.commission_rate is 'Commission rate as percent (e.g. 4.50 for 4.5%) — for revenue projection';
comment on column items.affiliate_lookup_attempted_at is 'Last time the auto-discovery service tried to find an affiliate link';
comment on column items.affiliate_lookup_status is 'pending | found | not_found | manual | skipped';

create index if not exists idx_items_affiliate_status
  on items(affiliate_lookup_status)
  where affiliate_lookup_status = 'pending';

-- 2. Click tracking — every outbound click on an affiliate link.
-- This drives the revenue dashboard + lets us prioritize discovery for
-- high-traffic items.
create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  item_id uuid references items(id) on delete set null,
  item_name text,
  affiliate_network text,
  vendor text,
  affiliate_url text not null,
  source text, -- 'item_detail' | 'purchases' | 'coach_proposal' | 'recipe' | 'audit'
  clicked_at timestamptz default now()
);

create index if not exists idx_affiliate_clicks_user_time
  on affiliate_clicks(user_id, clicked_at desc);
create index if not exists idx_affiliate_clicks_item_time
  on affiliate_clicks(item_id, clicked_at desc);

alter table affiliate_clicks enable row level security;

-- Users can read their own clicks (for "X others on Regimen take this"
-- aggregations we use admin client). Insertions are server-side only.
create policy "users read own clicks"
  on affiliate_clicks for select
  using (auth.uid() = user_id);

-- 3. Conversion log — when a user actually orders an item we have a
-- click row for. Currently driven by /purchases state transition to
-- "ordered" within N days of a click. Future: Stripe webhook for direct
-- referrals.
create table if not exists public.affiliate_conversions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  item_id uuid references items(id) on delete set null,
  click_id uuid references affiliate_clicks(id) on delete set null,
  affiliate_network text,
  estimated_commission_cents integer,
  converted_at timestamptz default now()
);

create index if not exists idx_affiliate_conversions_time
  on affiliate_conversions(converted_at desc);

alter table affiliate_conversions enable row level security;
create policy "users read own conversions"
  on affiliate_conversions for select
  using (auth.uid() = user_id);

-- 4. View for the revenue dashboard
create or replace view public.affiliate_stats as
select
  date_trunc('day', clicked_at) as day,
  affiliate_network,
  count(*) as click_count,
  count(distinct user_id) as unique_users,
  count(distinct item_id) as unique_items
from affiliate_clicks
where clicked_at >= now() - interval '90 days'
group by 1, 2
order by 1 desc, 2;

comment on view affiliate_stats is 'Owner-facing daily click totals for /strategy revenue dashboard';


-- ============================
-- 022_upgrade_interest.sql
-- ============================
-- Migration 022 — upgrade_interest leads table.
-- Captures interest from the /upgrade page until Stripe is wired up.
-- Lets the owner email "early list" users the moment checkout opens.

create table if not exists public.upgrade_interest (
  user_id uuid references auth.users(id) on delete cascade,
  tier text not null,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (user_id, tier)
);

create index if not exists idx_upgrade_interest_updated
  on upgrade_interest(updated_at desc);

alter table upgrade_interest enable row level security;

-- Users can read their own interest record (so the UI could show
-- "you're on the early list" persistence later)
create policy "users read own interest"
  on upgrade_interest for select
  using (auth.uid() = user_id);

-- Inserts/updates are server-side only via service-role, but we add a
-- permissive policy in case the RLS path is needed
create policy "users upsert own interest"
  on upgrade_interest for insert
  with check (auth.uid() = user_id);

create policy "users update own interest"
  on upgrade_interest for update
  using (auth.uid() = user_id);


-- ============================
-- 023_catalog.sql
-- ============================
-- Migration 023 — Global catalog of foods, supplements, products.
--
-- Strategy: pull from public databases (USDA FoodData Central, Open Food
-- Facts, NIH Dietary Supplement Label Database) into a shared catalog
-- table. Coach enriches each catalog entry with mechanism, timing,
-- brand picks, conflicts, and evidence grade. User items link to a
-- catalog entry so the data is shared across users.
--
-- Why a separate table: a user's `items` table is their stack — what
-- THEY take. catalog_items is the universal product database — what
-- EXISTS. One catalog entry → many user items.

create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  source text not null,                  -- 'usda' | 'off' (Open Food Facts) | 'dsld' | 'manual' | 'coach'
  source_id text,                        -- external identifier from the source
  name text not null,
  brand text,
  item_type text not null,               -- 'supplement' | 'food' | 'topical' | 'gear' | 'device' | 'test'
  category text,                         -- 'vitamin' | 'mineral' | 'amino' | 'omega' | 'protein' | 'whole_food' | etc.
  upc text,                              -- barcode if known (Open Food Facts has these)

  -- Macro nutrients per 100g (food) or per serving (supplement)
  calories numeric,
  protein_g numeric,
  fat_g numeric,
  carbs_g numeric,
  fiber_g numeric,
  sugar_g numeric,

  -- Micronutrients — JSONB so we don't blow up the column count
  -- Shape: { "vitamin_d_iu": 1000, "magnesium_mg": 200, "iron_mg": 18, ... }
  micros jsonb,

  -- Supplement-specific fields
  active_ingredients jsonb,              -- [{ name, amount, unit }]
  serving_size text,                     -- "1 capsule" | "1 tbsp" | "1 scoop"
  servings_per_container int,

  -- Coach enrichment (filled lazily by enrichment service)
  coach_summary text,                    -- 2-3 sentence plain-English "what + why"
  mechanism text,                        -- pharmacological mechanism if known
  best_timing text,                      -- e.g. "with breakfast", "before bed"
  pairs_well_with jsonb,                 -- [{ name, reason }]
  conflicts_with jsonb,                  -- [{ name, reason }]
  cautions jsonb,                        -- [{ tag, note }] — pregnancy/kidney/antiplatelet/etc.
  brand_recommendations jsonb,           -- [{ brand, reasoning, vendor_url }]
  evidence_grade text,                   -- 'A' | 'B' | 'C' | 'D' (Examine-style)
  enriched_at timestamptz,
  enriched_by text,                      -- 'coach-v1'

  -- Default affiliate routing — populated by the existing
  -- /api/affiliates/discover pipeline; user items inherit this when
  -- they don't have their own affiliate_url.
  default_affiliate_url text,
  default_vendor text,
  default_list_price_cents int,
  default_affiliate_network text,

  -- Search aliases — manually-curated synonyms ("vit d", "D3",
  -- "cholecalciferol") so search works the way users actually type
  search_aliases text[] default array[]::text[],

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Search indexes — using simple btree on lower(name) for ilike matching.
-- We tried a GIN tsvector index first but Postgres flags it as not
-- IMMUTABLE because array_to_string + concat + to_tsvector together are
-- considered too dynamic for an expression index even with regconfig
-- casts. lower() is definitively IMMUTABLE so this works everywhere,
-- and ilike '%q%' is fast enough for tens-of-thousands of catalog rows.
-- A proper full-text index can be added later as a generated tsvector
-- column when the catalog grows past 100k rows.
create index if not exists idx_catalog_name_lower
  on catalog_items (lower(name));

create index if not exists idx_catalog_brand_lower
  on catalog_items (lower(coalesce(brand, '')));

create index if not exists idx_catalog_upc
  on catalog_items(upc) where upc is not null;

create unique index if not exists idx_catalog_source_lookup
  on catalog_items(source, source_id) where source_id is not null;

create index if not exists idx_catalog_item_type
  on catalog_items(item_type);

-- Catalog is publicly readable (it's product data) but only service-role
-- writes. We don't put RLS on it — it's reference data, like a phone book.
-- Frontends use the user-anon key to read; importers use service-role.
alter table catalog_items enable row level security;
create policy "anyone can read catalog"
  on catalog_items for select
  using (true);

-- Link from user items to catalog entry (when matched)
alter table items
  add column if not exists catalog_item_id uuid references catalog_items(id) on delete set null;

create index if not exists idx_items_catalog
  on items(catalog_item_id) where catalog_item_id is not null;

comment on column items.catalog_item_id is 'Optional link to a shared catalog_items row — pre-fills macros, micros, mechanism, timing, brand picks. Inherits affiliate URL when user has no override.';

-- Track import runs so we can monitor coverage growth + rate-limit
create table if not exists public.catalog_import_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  query text,
  imported_count int default 0,
  error_count int default 0,
  status text not null default 'running',  -- 'running' | 'done' | 'error'
  started_at timestamptz default now(),
  finished_at timestamptz,
  notes text
);

create index if not exists idx_import_runs_started
  on catalog_import_runs(started_at desc);

