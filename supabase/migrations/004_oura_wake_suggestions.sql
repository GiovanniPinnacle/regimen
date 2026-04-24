-- Migration 004 — Oura wake time + Oura PAT storage + daily suggestions support

alter table public.oura_daily
  add column if not exists wake_time timestamptz,
  add column if not exists bedtime_start timestamptz,
  add column if not exists sleep_score int;

alter table public.profiles
  add column if not exists oura_pat text,
  add column if not exists oura_last_sync timestamptz,
  add column if not exists timezone text default 'America/New_York';
