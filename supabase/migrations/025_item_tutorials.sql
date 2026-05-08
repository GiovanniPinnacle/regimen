-- Migration 025 — tutorial / how-to links on items
--
-- Practice items (mewing, scalp massage, kegels, breathwork, cold plunge,
-- gym days, mobility routines, etc.) need direct links to *how to do*
-- the thing. Until now we've been stuffing video links into usage_notes
-- as plain text. This migration breaks them out into structured fields
-- so the UI can render a "Watch how" button + the post-add enrichment
-- pipeline can populate them automatically from the catalog.
--
-- ProtocolItem already has media_url; this just brings the user-facing
-- items table to parity.

alter table public.items
  add column if not exists media_url text,
  add column if not exists how_to text;

-- Same shape on catalog_items so enrichment can flow through. ProtocolItem
-- (in code) → catalog_items (DB) → user items (DB).
alter table public.catalog_items
  add column if not exists media_url text,
  add column if not exists how_to text;
