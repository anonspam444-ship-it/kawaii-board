-- kawaii-board — Supabase schema
-- Run this in the Supabase SQL editor: Dashboard → SQL Editor → New query → paste → Run.
--
-- This file is the full, current schema and is safe to re-run: every statement
-- is idempotent. If your database predates the author column or the streak
-- table, running this brings it up to date (see also migrations/).

-- gen_random_uuid() lives in pgcrypto (ships with Supabase, but be explicit).
create extension if not exists "pgcrypto";

-- ============================================================
-- entries — the Worth List and the Worst List
-- ============================================================
create table if not exists public.entries (
  id         uuid        primary key default gen_random_uuid(),
  text       text        not null,
  list       text        not null check (list in ('worth', 'worst')),
  -- Who pinned it. Self-declared: the browser asks for a name on first visit
  -- and keeps it in localStorage — there are no accounts, so treat this as a
  -- signature rather than proof of identity. Nullable because entries made
  -- before this column existed have nobody to credit.
  author     text,
  created_at timestamptz not null default now()
);

-- Older databases: add the column without touching existing rows.
alter table public.entries add column if not exists author text;

-- Fast fetch/ordering per column.
create index if not exists entries_list_created_idx
  on public.entries (list, created_at);

-- ============================================================
-- streak — the no-contact day counter
-- ============================================================
-- Exactly one row, forever: the `check (id = 1)` makes a second row impossible
-- at the database level, so the server can always upsert/select id=1 without
-- worrying about which of several rows it got.
create table if not exists public.streak (
  id            smallint    primary key default 1 check (id = 1),
  -- Current run of clean days.
  count         integer     not null default 0 check (count >= 0),
  -- Longest run ever reached. A reset zeroes `count` but never this, so a
  -- relapse costs the streak without erasing the fact that it happened.
  best          integer     not null default 0 check (best >= 0),
  -- The local calendar date of the last check-in, as a plain date. Stored as
  -- the *browser's* date rather than a UTC timestamp, so "one per day" means
  -- one per her day — a UTC rollover would let her double up or lock her out
  -- depending on the timezone.
  last_check_in date,
  updated_at    timestamptz not null default now()
);

insert into public.streak (id) values (1) on conflict (id) do nothing;

-- ============================================================
-- Row Level Security: ENABLED with no public policies.
-- The Express server connects with the service-role key, which bypasses RLS,
-- so it remains the only way to read/write these tables. Any anon/authenticated
-- browser client (using the public anon key) is denied by default — exactly
-- what we want, since we never expose the tables directly to the browser.
-- ============================================================
alter table public.entries enable row level security;
alter table public.streak  enable row level security;
