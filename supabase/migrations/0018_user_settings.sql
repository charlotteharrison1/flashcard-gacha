-- Per-user presets (defaults for new decks and cards). Run once in Supabase Dashboard > SQL Editor,
-- after 0017. If it hasn't been run, the Settings panel still opens but can't remember anything.

create table public.user_settings (
  user_id      uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  default_font text not null default 'clear' check (default_font in ('clear', 'classic', 'serif', 'mono', 'retro')),
  show_both    boolean not null default false,  -- new decks keep the answer on screen with the question (no flip)
  float_anim   boolean not null default true,   -- new decks float the study card
  updated_at   timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "user_settings: own row" on public.user_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
