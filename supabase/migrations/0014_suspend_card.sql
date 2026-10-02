-- "Suspend": hide a card for a day. Run once in Supabase Dashboard > SQL Editor.
-- Safe to run at any time (it only adds a function). Needed once 0013 is applied, because 0013
-- stops the browser changing a card's due date directly.
--
-- Pushes the card's due date to 24 hours from now. A card that's already due later than that is
-- left where it is, so suspending never makes a card come back sooner. Earns nothing.

create or replace function public.suspend_card(p_card_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  update public.cards
  set due_at = greatest(due_at, now() + interval '1 day')
  where id = p_card_id and user_id = auth.uid()
  returning due_at into v_due;

  if not found then
    raise exception 'card not found';
  end if;
  return v_due;
end;
$$;

revoke all on function public.suspend_card(uuid) from public, anon;
grant execute on function public.suspend_card(uuid) to authenticated;
