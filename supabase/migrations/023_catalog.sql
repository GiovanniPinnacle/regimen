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

-- Full-text search index on name + brand + aliases.
-- Postgres needs an explicit regconfig cast for to_tsvector to be
-- recognized as IMMUTABLE in an index expression. Without the
-- '::regconfig' cast, PG treats it as STABLE and rejects the index
-- with "42P17: functions in index expression must be marked IMMUTABLE".
create index if not exists idx_catalog_search
  on catalog_items using gin (
    to_tsvector(
      'english'::regconfig,
      coalesce(name, '') || ' ' ||
      coalesce(brand, '') || ' ' ||
      coalesce(array_to_string(search_aliases, ' '), '')
    )
  );

-- Btree on lower(name) accelerates the ilike '%q%' path used by
-- /api/catalog/search when full-text doesn't match
create index if not exists idx_catalog_name_lower
  on catalog_items (lower(name));

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
