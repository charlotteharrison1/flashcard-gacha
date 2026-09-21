-- Flashcard app schema. Run once in Supabase Dashboard > SQL Editor.
-- Users live in Supabase's built-in auth.users table.

create table public.decks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.cards (
  id            uuid primary key default gen_random_uuid(),
  deck_id       uuid not null references public.decks(id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  front         text not null check (char_length(front) between 1 and 5000),
  back          text not null check (char_length(back) between 1 and 5000),
  source        text not null default 'manual' check (source in ('manual', 'csv')),
  -- spaced-repetition state lives on the card so "due today" is a single indexed query
  ease          real not null default 2.5,
  interval_days int  not null default 0,
  repetitions   int  not null default 0,
  due_at        timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index cards_deck_due_idx on public.cards (deck_id, due_at);
create index cards_user_idx on public.cards (user_id);

-- Append-only log of every answer (for stats, streaks, gacha rewards later).
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  card_id     uuid not null references public.cards(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rating      smallint not null check (rating between 0 and 3), -- 0 again, 1 hard, 2 good, 3 easy
  reviewed_at timestamptz not null default now()
);

create index reviews_user_time_idx on public.reviews (user_id, reviewed_at desc);

-- Row-level security: every user can only touch their own rows.
alter table public.decks   enable row level security;
alter table public.cards   enable row level security;
alter table public.reviews enable row level security;

create policy "decks: own rows" on public.decks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "cards: own rows" on public.cards
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.decks d where d.id = deck_id and d.user_id = auth.uid())
  );

create policy "reviews: own rows" on public.reviews
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.cards c where c.id = card_id and c.user_id = auth.uid())
  );
