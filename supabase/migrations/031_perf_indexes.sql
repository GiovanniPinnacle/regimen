-- 031 — Hot-path indexes + RLS policies that evaluate auth.uid() once.
--
-- Idempotent: every index is IF NOT EXISTS and every policy is
-- DROP POLICY IF EXISTS + CREATE POLICY with the SAME name and the same
-- semantics as before. Safe to re-run. No data changes.
--
-- 1) Indexes for the queries Coach context / changelog / chat history
--    run on every request:
--      changelog: .eq(user_id).gte(date)            → (user_id, date)
--                 .eq(user_id).order(created_at)    → (user_id, created_at desc)
--      claude_conversations: latest turn per user   → (user_id, created_at desc)
--      stack_log: per-item lookups / upserts        → (user_id, item_id, date)
--                 (the existing unique(user_id, date, item_id) already
--                 covers user+date range scans; this one serves item-first
--                 access like streaks/adherence for a single item)
--      insights:  cron "already inserted today?" + feed → (user_id, created_at)
--
-- 2) RLS: Postgres re-evaluates a bare `auth.uid()` for EVERY row a
--    policy checks. Wrapping it as `(select auth.uid())` turns it into an
--    initPlan evaluated once per statement (Supabase advisor lint 0003,
--    "auth_rls_initplan"). Same predicate, same access — just faster on
--    multi-row reads (stack_log / changelog / intake_log scans).
--
-- NOTE: plain CREATE INDEX (not CONCURRENTLY) because migrations run in a
-- transaction. These tables are small per-user; the brief lock is fine.
-- For a large production table, create the index CONCURRENTLY by hand
-- first — the IF NOT EXISTS here then no-ops.

-- ---------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------

create index if not exists idx_changelog_user_date
  on public.changelog (user_id, date);

create index if not exists idx_changelog_user_created
  on public.changelog (user_id, created_at desc);

create index if not exists idx_claude_conversations_user_created
  on public.claude_conversations (user_id, created_at desc);

create index if not exists idx_stack_log_user_item_date
  on public.stack_log (user_id, item_id, date);

create index if not exists idx_insights_user_created
  on public.insights (user_id, created_at);

-- ---------------------------------------------------------------------
-- RLS: profiles (keyed on id, from 001)
-- ---------------------------------------------------------------------

drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles
  for select using ((select auth.uid()) = id);

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update using ((select auth.uid()) = id);

-- ---------------------------------------------------------------------
-- RLS: generic owner policies from 001 ("own <table> read|insert|update|delete")
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  for t in
    select unnest(array[
      'items','stack_log','symptom_log','meal_log','scalp_photos',
      'data_imports','oura_daily','cgm_readings','insights',
      'reviews','changelog','claude_conversations'
    ])
  loop
    -- Skip tables that don't exist in this environment.
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;

    execute format('drop policy if exists "own %s read" on public.%I;', t, t);
    execute format(
      'create policy "own %s read" on public.%I for select using ((select auth.uid()) = user_id);',
      t, t);

    execute format('drop policy if exists "own %s insert" on public.%I;', t, t);
    execute format(
      'create policy "own %s insert" on public.%I for insert with check ((select auth.uid()) = user_id);',
      t, t);

    execute format('drop policy if exists "own %s update" on public.%I;', t, t);
    execute format(
      'create policy "own %s update" on public.%I for update using ((select auth.uid()) = user_id);',
      t, t);

    execute format('drop policy if exists "own %s delete" on public.%I;', t, t);
    execute format(
      'create policy "own %s delete" on public.%I for delete using ((select auth.uid()) = user_id);',
      t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- RLS: daily_checkins (012)
-- ---------------------------------------------------------------------

drop policy if exists "own checkins read" on public.daily_checkins;
create policy "own checkins read" on public.daily_checkins
  for select using ((select auth.uid()) = user_id);

drop policy if exists "own checkins insert" on public.daily_checkins;
create policy "own checkins insert" on public.daily_checkins
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "own checkins update" on public.daily_checkins;
create policy "own checkins update" on public.daily_checkins
  for update using ((select auth.uid()) = user_id);

drop policy if exists "own checkins delete" on public.daily_checkins;
create policy "own checkins delete" on public.daily_checkins
  for delete using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- RLS: "for all" owner policies (015–018)
-- ---------------------------------------------------------------------

drop policy if exists "Users manage their own enrollments" on public.protocol_enrollments;
create policy "Users manage their own enrollments" on public.protocol_enrollments
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own reactions" on public.item_reactions;
create policy "Users manage their own reactions" on public.item_reactions
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own voice memos" on public.voice_memos;
create policy "Users manage their own voice memos" on public.voice_memos
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own intake" on public.intake_log;
create policy "Users manage their own intake" on public.intake_log
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- RLS: biomarkers (026)
-- ---------------------------------------------------------------------

drop policy if exists "own biomarkers read" on public.biomarkers;
create policy "own biomarkers read" on public.biomarkers
  for select using ((select auth.uid()) = user_id);

drop policy if exists "own biomarkers insert" on public.biomarkers;
create policy "own biomarkers insert" on public.biomarkers
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "own biomarkers update" on public.biomarkers;
create policy "own biomarkers update" on public.biomarkers
  for update using ((select auth.uid()) = user_id);

drop policy if exists "own biomarkers delete" on public.biomarkers;
create policy "own biomarkers delete" on public.biomarkers
  for delete using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- RLS: catalog_items read (027) — scanned by every catalog search
-- ---------------------------------------------------------------------

drop policy if exists "read verified catalog or own pending" on public.catalog_items;
create policy "read verified catalog or own pending" on public.catalog_items
  for select
  using (
    is_verified = true
    or submitted_by = (select auth.uid())
  );

-- ---------------------------------------------------------------------
-- RLS: llm_usage read (028)
-- ---------------------------------------------------------------------

drop policy if exists "users read own llm usage" on public.llm_usage;
create policy "users read own llm usage" on public.llm_usage
  for select using ((select auth.uid()) = user_id);
