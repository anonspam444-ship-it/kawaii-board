-- Migration 004 — the notification feed.
--
-- Idempotent: safe to run twice. Run in the Supabase SQL editor.

-- Every notifiable thing that happens on the feed, append-only.
--
-- Read with a per-browser cursor rather than a read/unread flag: a client
-- remembers the last id it has seen and asks for anything newer. That keeps
-- this table write-once (no per-viewer state to fan out on every post) and
-- means "everyone gets told about a new post" costs exactly one row.
create table if not exists public.events (
  id               bigserial   primary key,
  kind             text        not null check (kind in ('post', 'like', 'comment')),
  actor_client_id  uuid        not null,
  -- NULL means broadcast: everyone sees it. Set means it's for one person,
  -- which is how "someone liked *your* post" stays private to the owner.
  target_client_id uuid,
  -- Cascade so notifications about a deleted post disappear with it, rather
  -- than toasting people about something they can no longer open.
  post_id          uuid        references public.posts (id) on delete cascade,
  -- A short excerpt, copied at write time on purpose: the toast should read
  -- the same later even if the post is edited, and it avoids a join.
  snippet          text,
  created_at       timestamptz not null default now()
);

-- The only two read patterns: "newest overall" and "newest for this person".
create index if not exists events_id_idx on public.events (id desc);
create index if not exists events_target_idx on public.events (target_client_id, id desc);

alter table public.events enable row level security;
