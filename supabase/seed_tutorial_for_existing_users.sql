-- One-off: replaces every EXISTING account's "Start Here" deck with the current guided version (and gives
-- one to accounts that never had it). Run in Supabase Dashboard > SQL Editor, after 0022_guided_decks.sql.
-- Warning: deletes the old "Start Here" deck, its cards, review history and any edits to it.
-- Other decks are untouched. Safe to run again (it just replaces the deck again).

do $$
declare
  u record;
begin
  for u in select id from auth.users loop
    delete from public.decks where user_id = u.id and name = 'Start Here';
    perform public.create_tutorial_deck(u.id);
  end loop;
end $$;
