-- Migration 003 — Web Push subscriptions
-- Stores browser/PWA push endpoints so cron jobs can send notifications

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now(),
  unique(user_id, endpoint)
);

create index if not exists idx_push_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

create policy "own push_subscriptions read"
  on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "own push_subscriptions insert"
  on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "own push_subscriptions delete"
  on public.push_subscriptions for delete using (auth.uid() = user_id);
