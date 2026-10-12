-- A short bio for a deck or deckbox. Run once in Supabase Dashboard > SQL Editor, after 0024.
-- Run it BEFORE deploying the app version that reads these columns.

alter table public.decks add column description text check (char_length(description) <= 500);
alter table public.deckboxes add column description text check (char_length(description) <= 500);
