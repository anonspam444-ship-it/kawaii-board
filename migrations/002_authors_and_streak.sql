-- Migration 002 — entry authors + the no-contact streak counter.
--
-- Run against a database that already has the original `entries` table.
-- Idempotent: safe to run twice. (supabase.sql now contains the same changes,
-- so running that instead works too — this file is just the smaller diff.)

-- Who pinned each entry. Nullable: rows created before this column existed
-- have no author, and the UI renders those without a byline.
alter table public.entries add column if not exists author text;

-- Single-row counter table. See supabase.sql for the full column notes.
create table if not exists public.streak (
  id            smallint    primary key default 1 check (id = 1),
  count         integer     not null default 0 check (count >= 0),
  best          integer     not null default 0 check (best >= 0),
  last_check_in date,
  updated_at    timestamptz not null default now()
);

insert into public.streak (id) values (1) on conflict (id) do nothing;

alter table public.streak enable row level security;
