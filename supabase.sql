-- kawaii-board — Supabase schema
-- Run this in the Supabase SQL editor: Dashboard → SQL Editor → New query → paste → Run.

-- gen_random_uuid() lives in pgcrypto (ships with Supabase, but be explicit).
create extension if not exists "pgcrypto";

create table if not exists public.entries (
  id         uuid        primary key default gen_random_uuid(),
  text       text        not null,
  list       text        not null check (list in ('worth', 'worst')),
  created_at timestamptz not null default now()
);

-- Fast fetch/ordering per column.
create index if not exists entries_list_created_idx
  on public.entries (list, created_at);

-- Row Level Security: ENABLED with no public policies.
-- The Express server connects with the service-role key, which bypasses RLS,
-- so it remains the only way to read/write this table. Any anon/authenticated
-- browser client (using the public anon key) is denied by default — exactly
-- what we want, since we never expose the table directly to the browser.
alter table public.entries enable row level security;
