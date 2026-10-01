-- Each card remembers which font it was written in. 'clear' (Atkinson Hyperlegible) is the
-- new default for readability — the pixel font now stays on buttons/chrome only, not card text.
-- Run once in Supabase Dashboard > SQL Editor, after 0008_card_image.sql.

alter table public.cards
  add column font text not null default 'clear'
  check (font in ('clear', 'classic', 'serif', 'mono', 'retro'));
