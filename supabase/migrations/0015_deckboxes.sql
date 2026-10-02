-- Deckboxes: folders that hold several decks. Run once in Supabase Dashboard > SQL Editor,
-- after 0014. Run this BEFORE deploying the app version that uses deckboxes, or the home page
-- will fail to load (it asks for decks.deckbox_id).
--
-- Deleting a deckbox does not delete its decks: they go back to the home screen.

create table public.deckboxes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);

create index deckboxes_user_idx on public.deckboxes (user_id);

alter table public.deckboxes enable row level security;

create policy "deckboxes: own rows" on public.deckboxes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.decks
  add column deckbox_id uuid references public.deckboxes(id) on delete set null;

create index decks_deckbox_idx on public.decks (deckbox_id);

-- A deck may only be put in one of the owner's own deckboxes.
drop policy "decks: own rows" on public.decks;
create policy "decks: own rows" on public.decks
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      deckbox_id is null
      or exists (select 1 from public.deckboxes b where b.id = deckbox_id and b.user_id = auth.uid())
    )
  );
