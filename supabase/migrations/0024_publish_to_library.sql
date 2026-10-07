-- Copies one of your decks onto the Library shelf. Run once in Supabase Dashboard > SQL Editor, after 0023.
--
-- Then, to publish (or update) a deck, run one line in the SQL Editor:
--   select publish_to_library('<deck id from the deck page address>', 'calculus-1', 'Calculus 1', 'Limits, derivatives and integrals.', 1, 'diamond');
-- Arguments: deck id, URL name (unique), title, description, colour 0-5, logo (see 0021 for the names),
-- and optionally: sort order (smaller = earlier on the shelf, default 100) and guided (true = fixed order, due once only).
-- Running it again with the same URL name replaces the shelf copy with the deck's current cards.
-- Copies people already took are not changed. Only the SQL Editor can run this; the app cannot.

create or replace function public.publish_to_library(
  p_deck_id uuid,
  p_slug text,
  p_name text,
  p_description text default '',
  p_color int default null,
  p_logo text default null,
  p_sort int default 100,
  p_guided boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_lib uuid;
  v_count int;
begin
  if not exists (select 1 from public.decks where id = p_deck_id) then
    raise exception 'no deck with id %', p_deck_id;
  end if;

  select id into v_lib from public.library_decks where slug = p_slug;
  if v_lib is null then
    insert into public.library_decks (slug, name, description, color, logo, guided, sort)
    values (p_slug, p_name, p_description, p_color, p_logo, p_guided, p_sort)
    returning id into v_lib;
  else
    update public.library_decks
    set name = p_name, description = p_description, color = p_color, logo = p_logo, guided = p_guided, sort = p_sort
    where id = v_lib;
    delete from public.library_cards where library_deck_id = v_lib;
  end if;

  -- Cards go on the shelf in the order they were written.
  insert into public.library_cards (library_deck_id, position, front, back, font)
  select v_lib, row_number() over (order by created_at, id), front, back, font
  from public.cards
  where deck_id = p_deck_id;

  select count(*) into v_count from public.library_cards where library_deck_id = v_lib;
  return 'Published "' || p_name || '" with ' || v_count || ' cards at /library/' || p_slug;
end;
$fn$;

revoke all on function public.publish_to_library(uuid, text, text, text, int, text, int, boolean) from public, anon, authenticated;
