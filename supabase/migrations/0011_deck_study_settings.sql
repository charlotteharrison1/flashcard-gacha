-- Per-deck study display settings, set in the deck editor instead of toggled live during study.
-- Run once in Supabase Dashboard > SQL Editor, after 0010_inline_images.sql.

alter table public.decks add column show_both boolean not null default false;
alter table public.decks add column float_anim boolean not null default true;
