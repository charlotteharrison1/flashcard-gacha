-- One-off: gives every EXISTING account the "Start Here" tutorial deck too (0020's trigger only
-- fires for new signups). Run once in Supabase Dashboard > SQL Editor, after 0020. Safe to run
-- again — it skips anyone who already has a deck named "Start Here".

do $$
declare
  u record;
begin
  for u in select id from auth.users loop
    if not exists (select 1 from public.decks where user_id = u.id and name = 'Start Here') then
      perform public.create_tutorial_deck(u.id);
    end if;
  end loop;
end $$;
