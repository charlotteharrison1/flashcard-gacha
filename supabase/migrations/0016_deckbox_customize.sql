-- Deckboxes get the same colour / icon-image options as decks.
-- Run once in Supabase Dashboard > SQL Editor, after 0015_deckboxes.sql. Run it BEFORE deploying
-- the app version that reads these columns.

alter table public.deckboxes add column color smallint check (color between 0 and 5);
alter table public.deckboxes add column icon_url text;
