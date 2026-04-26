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
