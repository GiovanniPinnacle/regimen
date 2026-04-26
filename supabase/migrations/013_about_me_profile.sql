-- Migration 013 — richer profile context (about_me jsonb)
-- Captures the data Claude should know about the user beyond body comp:
-- goals in their own words, lifestyle, stress sources, family history,
-- allergies, medications, values, vision, etc.

alter table public.profiles
  add column if not exists about_me jsonb default '{}'::jsonb;
