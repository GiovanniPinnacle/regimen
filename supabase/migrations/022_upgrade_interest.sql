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
