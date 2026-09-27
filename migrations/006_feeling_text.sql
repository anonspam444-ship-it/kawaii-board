-- Migration 006 — the feeling is whatever you say it is.
--
-- Idempotent: safe to run twice. Run in the Supabase SQL editor.

-- Migration 005 stored only which emoji was picked, and the word beside it
-- came from a fixed list in the client. Now the word is typed by whoever is
-- posting, so it has to be stored per post.
--
-- `feeling` keeps holding the emoji key; this holds their text. Either can be
-- present without the other: an emoji on its own is a valid feeling, and so is
-- a word with no face.
alter table public.posts add column if not exists feeling_text text;

-- Keep the emptiness rule honest: a post carrying only a typed feeling and no
-- emoji is still a post with something in it.
alter table public.posts drop constraint if exists posts_not_empty;
alter table public.posts add constraint posts_not_empty
  check (
    length(btrim(body)) > 0
    or image_url is not null
    or feeling is not null
    or length(btrim(coalesce(feeling_text, ''))) > 0
  );
