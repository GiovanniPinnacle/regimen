-- 030 — first-run onboarding completion marker.
--
-- New users no longer get the owner's personal regimen seeded on sign-in;
-- they go through /onboard instead. `onboarded_at` records when they
-- finished (or explicitly skipped) it, so the app stops routing them back.
--
-- Backfill: anyone who already has items or a display name predates the new
-- flow and counts as onboarded — they must never be bounced into /onboard.
--
-- App code tolerates this column being absent (falls back to the old
-- display_name check), so this can ship before or after the deploy.

alter table public.profiles
  add column if not exists onboarded_at timestamptz;

update public.profiles p
set onboarded_at = coalesce(p.created_at, now())
where p.onboarded_at is null
  and (
    p.display_name is not null
    or exists (select 1 from public.items i where i.user_id = p.id)
  );
