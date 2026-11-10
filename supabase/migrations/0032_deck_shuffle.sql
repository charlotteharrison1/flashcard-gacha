-- "Shuffle cards when studying" as a per-deck option (Deck options on the deck page). Off by default.
-- Run once in Supabase Dashboard > SQL Editor. Until it's run, the checkbox shows an error when you tick it.
alter table public.decks add column if not exists shuffle boolean not null default false;
