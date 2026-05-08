-- Migration 027 — Catalog moderation gate.
--
-- Why: catalog_items is shared across all users. Migration 023 made it
-- public-read with no RLS on writes (relying on service-role-only writes
-- via Supabase admin client). Several routes — /api/catalog/import,
-- /api/items/enrich step 1, /api/catalog/generate — write to it on
-- behalf of any authenticated user. That means user A's hallucinated
-- "Vitamin D — take 100,000 IU" entry shows up in user B's autocomplete.
--
-- Strategy: keep the global catalog (so cross-user enrichment savings
-- still work) but gate visibility behind a verification flag. New
-- entries default to is_verified = false. Submitting user can see
-- their own entries; everyone else only sees verified ones. An admin
-- can promote pending entries to verified via /admin/catalog.
--
-- Existing rows: backfill is_verified = true. They came from trusted
-- importers (USDA, OFF, DSLD) or from the founder during dev. If any
-- specific row needs review, do it case-by-case post-migration.

alter table public.catalog_items
  add column if not exists is_verified boolean not null default false,
  add column if not exists submitted_by uuid references auth.users(id) on delete set null,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id) on delete set null;

-- Backfill existing rows. Anything that was in the catalog before this
-- migration is assumed legitimate (USDA / OFF / DSLD / founder seed).
update public.catalog_items
set is_verified = true,
    verified_at = coalesce(verified_at, created_at, now())
where is_verified = false;

-- Index for fast filtering on the verified-or-mine read path.
create index if not exists idx_catalog_verified
  on public.catalog_items(is_verified)
  where is_verified = true;

create index if not exists idx_catalog_submitted_by
  on public.catalog_items(submitted_by)
  where submitted_by is not null;

-- Replace the wide-open read policy with a moderation-aware one.
drop policy if exists "anyone can read catalog" on public.catalog_items;

create policy "read verified catalog or own pending"
  on public.catalog_items
  for select
  using (
    is_verified = true
    or submitted_by = auth.uid()
  );

-- We intentionally don't add an INSERT/UPDATE/DELETE policy here —
-- writes still go through the service-role admin client, but every
-- write path is responsible for stamping submitted_by + setting
-- is_verified appropriately. See src/lib/catalog/moderation.ts.

comment on column public.catalog_items.is_verified is
  'False = user-submitted, only visible to submitter. True = vetted by admin or imported from a trusted public source. Set to true via /admin/catalog after review.';
comment on column public.catalog_items.submitted_by is
  'Auth user who submitted this catalog entry, NULL for trusted public imports (USDA, OFF, DSLD).';
