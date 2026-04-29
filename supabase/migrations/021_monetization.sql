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
