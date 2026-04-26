-- Protocols — prebuilt, expert-authored regimens that users enroll in.
-- The protocol definitions themselves live in code (src/lib/protocols/*.ts)
-- so they ship with the app, are version-controlled, and load without a DB call.
-- This migration adds:
--   1. protocol_enrollments — which user enrolled in which protocol, when
--   2. items.from_protocol_slug + from_protocol_item_key — track which items
--      came from which protocol so we can render protocol context
--      and unenroll cleanly later.

create table if not exists protocol_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  protocol_slug text not null,
  enrolled_at timestamptz not null default now(),
  start_date date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'paused', 'cancelled')),
  unique(user_id, protocol_slug)
);

alter table items
  add column if not exists from_protocol_slug text,
  add column if not exists from_protocol_item_key text;

alter table protocol_enrollments enable row level security;

drop policy if exists "Users manage their own enrollments" on protocol_enrollments;
create policy "Users manage their own enrollments" on protocol_enrollments
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists protocol_enrollments_user_idx
  on protocol_enrollments(user_id);
create index if not exists items_protocol_idx
  on items(from_protocol_slug)
  where from_protocol_slug is not null;
