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
