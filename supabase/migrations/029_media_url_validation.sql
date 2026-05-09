-- Migration 029 — track when media URLs were last validated.
--
-- Why: Coach generates tutorial URLs at item-create time. The HEAD/
-- oEmbed gate in /api/items/enrich catches dead links at write-time,
-- but YouTube videos get taken down, channels deleted, uploaders go
-- private — videos that were live at save can be dead 30 days later.
--
-- Strategy: stamp every successfully-validated media_url with the
-- check timestamp. /api/cron/validate-urls re-checks the oldest 50
-- entries each daily run, demotes 404s to NULL. Worst-case staleness
-- is bounded by total_urls / 50 days.
--
-- Backfill: /api/admin/validate-urls (admin-only) sweeps the full
-- table once for the existing dead-URL backlog.

alter table public.items
  add column if not exists media_url_last_checked_at timestamptz;

alter table public.catalog_items
  add column if not exists media_url_last_checked_at timestamptz;

-- Index supports the cron's "oldest unchecked first" query.
create index if not exists idx_items_media_url_last_checked
  on public.items (media_url_last_checked_at nulls first)
  where media_url is not null;

create index if not exists idx_catalog_media_url_last_checked
  on public.catalog_items (media_url_last_checked_at nulls first)
  where media_url is not null;

comment on column public.items.media_url_last_checked_at is
  'When the URL was last verified live. Set by enrich (write-time) and the daily cron (re-validation). NULL = not yet validated → high priority for next cron run.';
comment on column public.catalog_items.media_url_last_checked_at is
  'See items.media_url_last_checked_at.';
