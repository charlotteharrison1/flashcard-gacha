-- Deck sizes on the home screen: a deck can be drawn as a normal card, a wide one (two cards across)
-- or a big one (twice as wide and twice as tall). Run once in Supabase Dashboard > SQL Editor.
-- Until it's run, every deck stays normal size and picking a size shows an error hint.
alter table public.decks
  add column if not exists card_size text not null default 'normal'
  check (card_size in ('normal', 'wide', 'big'));
