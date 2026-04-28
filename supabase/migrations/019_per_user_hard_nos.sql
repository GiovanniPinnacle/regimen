-- Per-user hard NOs. Was a global hardcoded list (Giovanni's banned items
-- — Hairpower biotin, ashwagandha standalone, Cosmedica shampoo, etc.).
-- Now stored as JSONB on profiles so each user owns their list.
--
-- Shape: array of { name: string, category: string, reason?: string }
-- Categories: 'pharmaceutical' | 'food' | 'supplement' | 'product' | 'test' | 'approach'

alter table profiles
  add column if not exists hard_nos jsonb default '[]'::jsonb;

comment on column profiles.hard_nos is 'Per-user hard NOs — items the user wants Claude to never recommend. Edited via /hard-nos.';
