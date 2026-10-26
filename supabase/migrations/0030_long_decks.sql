-- Adds a "long" deck size (full width across the shelf). Run once in Supabase Dashboard > SQL Editor, after 0028.
-- Until it's run, choosing Long shows an error hint and the deck stays its old size.
do $$
declare
  c text;
begin
  select conname into c from pg_constraint
  where conrelid = 'public.decks'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%card_size%';
  if c is not null then
    execute format('alter table public.decks drop constraint %I', c);
  end if;
  alter table public.decks add constraint decks_card_size_check check (card_size in ('normal', 'wide', 'big', 'long'));
end $$;
