-- Migration 026 — biomarkers table for bloodwork / lab data
--
-- Lets the user drop a photo or PDF of bloodwork, Claude Vision
-- parses it, biomarkers populate this table. Coach context reads
-- the latest values + trends so recommendations are grounded in
-- actual lab data instead of self-report.
--
-- One row per (user, biomarker_name, drawn_on) — re-uploads on the
-- same date upsert. Trends fall out of ordering by drawn_on.

create table if not exists public.biomarkers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  /** Canonical name like "ferritin", "vitamin_d_25oh", "hba1c". Coach
   *  normalizes during parse — e.g. "25-Hydroxy Vitamin D" →
   *  "vitamin_d_25oh" — so trends across labs work. */
  name text not null,
  /** Display name as it appeared on the report, in case canonical
   *  loses nuance ("Free Testosterone" vs "Total Testosterone"). */
  display_name text,
  /** Numeric value. */
  value numeric,
  /** Unit ("ng/dL", "mg/dL", "%", "U/L", etc.) */
  unit text,
  /** Reference range as a single string ("40-100", "<200", ">15"). */
  reference_range text,
  /** Lab's flag — H / L / N / abnormal / null. */
  flag text,
  /** Date drawn — falls back to test report date if unclear. */
  drawn_on date not null,
  /** Lab provider — 'function' | 'quest' | 'labcorp' | 'manual' | 'other'. */
  source text default 'manual',
  /** Optional grouping — "CBC", "CMP", "lipid panel", "thyroid". */
  panel text,
  /** Free-form notes / Coach comments. */
  notes text,
  /** Storage URL for the original photo / PDF — keep so Coach can
   *  re-parse if needed and the user has an audit trail. */
  source_file_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, name, drawn_on)
);

create index if not exists idx_biomarkers_user_drawn
  on public.biomarkers (user_id, drawn_on desc);
create index if not exists idx_biomarkers_user_name
  on public.biomarkers (user_id, name, drawn_on desc);

alter table public.biomarkers enable row level security;
create policy "own biomarkers read" on public.biomarkers
  for select using (auth.uid() = user_id);
create policy "own biomarkers insert" on public.biomarkers
  for insert with check (auth.uid() = user_id);
create policy "own biomarkers update" on public.biomarkers
  for update using (auth.uid() = user_id);
create policy "own biomarkers delete" on public.biomarkers
  for delete using (auth.uid() = user_id);
