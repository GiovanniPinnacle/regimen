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
