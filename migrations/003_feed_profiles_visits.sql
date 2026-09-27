-- Migration 003 — the feed, profiles with avatars, and visit logging.
--
-- Idempotent: safe to run twice. Run in the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ============================================================
-- profiles — who somebody is, as far as this board knows
-- ============================================================
-- There are still no accounts. The browser mints a random client_id on first
-- visit, keeps it in localStorage, and sends it with everything it does. That
-- makes a profile durable enough to hang a name and an avatar off, and lets
-- "one like per person" mean something — while staying spoofable by anyone who
-- edits their own requests. It is a signature, not a login.
create table if not exists public.profiles (
  client_id  uuid        primary key,
  name       text        not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- posts — one shared timeline, anyone may write
-- ============================================================
create table if not exists public.posts (
  id         uuid        primary key default gen_random_uuid(),
  -- No FK to profiles: a post should survive its author's profile being
  -- cleared, and the join is a left join for exactly that reason.
  client_id  uuid        not null,
  body       text        not null default '',
  image_url  text,
  created_at timestamptz not null default now(),
  -- A post has to carry something.
  constraint posts_not_empty check (length(btrim(body)) > 0 or image_url is not null)
);

create index if not exists posts_created_idx on public.posts (created_at desc);

-- ============================================================
-- post_likes — at most one per person per post
-- ============================================================
-- The composite primary key is the whole mechanism: a second like from the
-- same client_id is a primary-key conflict, not an application check, so no
-- amount of double-tapping inflates the count.
create table if not exists public.post_likes (
  post_id    uuid        not null references public.posts (id) on delete cascade,
  client_id  uuid        not null,
  created_at timestamptz not null default now(),
  primary key (post_id, client_id)
);

create index if not exists post_likes_post_idx on public.post_likes (post_id);

-- ============================================================
-- post_comments
-- ============================================================
create table if not exists public.post_comments (
  id         uuid        primary key default gen_random_uuid(),
  post_id    uuid        not null references public.posts (id) on delete cascade,
  client_id  uuid        not null,
  body       text        not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

-- ============================================================
-- visits — the access log
-- ============================================================
-- Written on every page load, read only by whoever holds ADMIN_PASSWORD.
-- bigserial rather than uuid: this is an append-only log read newest-first,
-- and a monotonic key is the cheapest way to get that ordering.
create table if not exists public.visits (
  id         bigserial   primary key,
  ip         text,
  user_agent text,
  path       text,
  referrer   text,
  -- Whoever the browser claims to be, when it has said. Null for a stranger.
  client_id  uuid,
  name       text,
  created_at timestamptz not null default now()
);

create index if not exists visits_created_idx on public.visits (created_at desc);
create index if not exists visits_ip_idx on public.visits (ip);

-- ============================================================
-- RLS on everything: the Express server holds the secret key and bypasses it,
-- so the server stays the only way in. The browser never talks to Postgres.
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.posts         enable row level security;
alter table public.post_likes    enable row level security;
alter table public.post_comments enable row level security;
alter table public.visits        enable row level security;
