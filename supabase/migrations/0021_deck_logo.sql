-- The logo on a deck's card back: one of a set of pixel-art icons. Run once in Supabase Dashboard >
-- SQL Editor, after 0020. Without it every deck keeps its automatic suit and the picker can't save.

alter table public.decks add column logo text
  check (logo in ('spade', 'heart', 'club', 'suitDiamond', 'star', 'cherry', 'seven', 'bar', 'diamond', 'bell', 'coin'));
