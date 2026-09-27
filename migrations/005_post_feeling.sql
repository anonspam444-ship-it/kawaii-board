-- Migration 005 — a feeling on each post.
--
-- Idempotent: safe to run twice. Run in the Supabase SQL editor.

-- The emoji name from client/src/emoji.js ("idea", "devil", …), not the mood
-- word shown next to it. Storing the key rather than the label means the
-- wording can be reworded without rewriting every row, and an unknown value
-- simply renders as no feeling rather than as broken text.
--
-- Nullable: a post doesn't have to have a feeling, and every post that existed
-- before this column doesn't.
alter table public.posts add column if not exists feeling text;

-- The original constraint demanded text or a picture. A post carrying only a
-- feeling is now a legitimate thing to write, so widen it. Dropping by name
-- first keeps this re-runnable.
alter table public.posts drop constraint if exists posts_not_empty;
alter table public.posts add constraint posts_not_empty
  check (length(btrim(body)) > 0 or image_url is not null or feeling is not null);
