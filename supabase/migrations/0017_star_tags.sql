-- Starred cards and tags. Run once in Supabase Dashboard > SQL Editor, after 0016.
-- Run it BEFORE deploying the app version that reads these columns, or the Study and Deck pages
-- will fail to load cards.
--
-- Tags are stored lowercase (the app normalises them) as a text[] on the card; at most 10 per card,
-- 1-30 characters each.

alter table public.cards add column starred boolean not null default false;
alter table public.cards add column tags text[] not null default '{}';

create function public.valid_tags(t text[])
returns boolean
language sql
immutable
as $$
  select coalesce(
    cardinality(t) <= 10 and not exists (select 1 from unnest(t) x where char_length(x) not between 1 and 30),
    false
  );
$$;

alter table public.cards add constraint cards_tags_valid check (public.valid_tags(tags));

create index cards_tags_idx on public.cards using gin (tags);
create index cards_starred_idx on public.cards (deck_id) where starred;

-- 0013 limited what the browser may write on cards; star and tags are fine to edit directly.
grant update (starred, tags) on public.cards to authenticated;
