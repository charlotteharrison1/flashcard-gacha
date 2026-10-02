-- Cards can be horizontal (wide, the default) or vertical (tall). A per-deck option, plus a preset
-- for new decks. Run once in Supabase Dashboard > SQL Editor, after 0018. The app works without it
-- (everything stays horizontal) but can't save the choice until it has been run.

alter table public.decks
  add column orientation text not null default 'horizontal' check (orientation in ('horizontal', 'vertical'));

alter table public.user_settings
  add column orientation text not null default 'horizontal' check (orientation in ('horizontal', 'vertical'));
