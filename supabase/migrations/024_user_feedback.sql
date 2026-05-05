-- Migration 024 — user feedback inbox
--
-- Lets the user fire one-tap "this is annoying" / "I want X" notes
-- from anywhere in the app. They land in user_feedback for me to
-- review on the next session. Coach can also surface recent feedback
-- as context (so it knows what the user has been complaining about
-- and can propose structural changes proactively).

create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,                  -- the user's note (free-form)
  category text default 'general',     -- 'bug' | 'feature' | 'ux' | 'general'
  source_path text,                    -- e.g. "/today" — where they were when they fired it
  source_context jsonb,                -- optional: {item_id, slot, etc.}
  status text default 'open',          -- 'open' | 'acknowledged' | 'shipped' | 'wont_do'
  triaged_at timestamptz,
  shipped_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_user_feedback_user
  on public.user_feedback(user_id, created_at desc);
create index if not exists idx_user_feedback_status
  on public.user_feedback(status, created_at desc);

alter table public.user_feedback enable row level security;
create policy "own feedback read" on public.user_feedback
  for select using (auth.uid() = user_id);
create policy "own feedback insert" on public.user_feedback
  for insert with check (auth.uid() = user_id);
create policy "own feedback update" on public.user_feedback
  for update using (auth.uid() = user_id);
