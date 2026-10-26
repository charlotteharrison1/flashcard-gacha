-- Speed: three database changes that make the home screen load faster.
-- Run once in Supabase Dashboard > SQL Editor, after 0026. Safe to run again. The app keeps working
-- before this is run (it falls back to the old, slower requests), so there's no rush on the order.
--
--  1. The coin balance is kept as a running total instead of being added up from every review, grant
--     and pull each time it's asked for. Triggers keep it exact; the balance means the same as before
--     (reviews + grants - pulls), including dropping if reviews are deleted along with their card.
--  2. Row-level security checks call auth.uid() once per query instead of once per row.
--  3. home_summary(): the whole home screen (decks with card and due counts, deckboxes, balance) in one request.

-- ---- 1. Running balance ---------------------------------------------------------------------------

create table if not exists public.user_totals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance bigint not null default 0
);
alter table public.user_totals enable row level security; -- no policies: only the functions below touch it
revoke all on public.user_totals from anon, authenticated;

create or replace function public.bump_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_user uuid;
  v_delta bigint;
begin
  if tg_op = 'INSERT' then
    v_user := new.user_id;
    if tg_table_name = 'reviews' then v_delta := coalesce(new.coins_earned, 0);
    elsif tg_table_name = 'earnings_grants' then v_delta := coalesce(new.amount, 0);
    else v_delta := -coalesce(new.cost, 0);
    end if;
    insert into public.user_totals (user_id, balance) values (v_user, v_delta)
    on conflict (user_id) do update set balance = public.user_totals.balance + excluded.balance;
  else
    v_user := old.user_id;
    if tg_table_name = 'reviews' then v_delta := coalesce(old.coins_earned, 0);
    elsif tg_table_name = 'earnings_grants' then v_delta := coalesce(old.amount, 0);
    else v_delta := -coalesce(old.cost, 0);
    end if;
    update public.user_totals set balance = balance - v_delta where user_id = v_user;
  end if;
  return null;
end;
$fn$;
revoke all on function public.bump_balance() from public, anon, authenticated;

drop trigger if exists bump_balance_reviews on public.reviews;
create trigger bump_balance_reviews after insert or delete on public.reviews
  for each row execute function public.bump_balance();
drop trigger if exists bump_balance_grants on public.earnings_grants;
create trigger bump_balance_grants after insert or delete on public.earnings_grants
  for each row execute function public.bump_balance();
drop trigger if exists bump_balance_pulls on public.pulls;
create trigger bump_balance_pulls after insert or delete on public.pulls
  for each row execute function public.bump_balance();

-- Start every account from its true balance, worked out the slow way one last time.
insert into public.user_totals (user_id, balance)
select u.id,
       coalesce((select sum(coins_earned) from public.reviews where user_id = u.id), 0)
     + coalesce((select sum(amount) from public.earnings_grants where user_id = u.id), 0)
     - coalesce((select sum(cost) from public.pulls where user_id = u.id), 0)
from auth.users u
on conflict (user_id) do update set balance = excluded.balance;

create or replace function public.get_earnings()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select balance from public.user_totals where user_id = (select auth.uid())), 0)::int;
$$;
revoke all on function public.get_earnings() from public, anon;
grant execute on function public.get_earnings() to authenticated;

-- ---- 2. Cheaper row-level security -------------------------------------------------------------------
-- Rewrites every policy in the public schema so auth.uid() becomes (select auth.uid()), which Postgres
-- evaluates once per query rather than once per row. The rules themselves are unchanged.

do $$
declare
  p record;
  stmt text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ilike '%auth.uid()%' or coalesce(with_check, '') ilike '%auth.uid()%')
      and coalesce(qual, '') not ilike '%select auth.uid()%'
      and coalesce(with_check, '') not ilike '%select auth.uid()%'
  loop
    stmt := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if p.qual is not null then
      stmt := stmt || format(' using (%s)', replace(p.qual, 'auth.uid()', '(select auth.uid())'));
    end if;
    if p.with_check is not null then
      stmt := stmt || format(' with check (%s)', replace(p.with_check, 'auth.uid()', '(select auth.uid())'));
    end if;
    execute stmt;
  end loop;
end $$;

-- ---- 3. The whole home screen in one request ---------------------------------------------------------
-- Runs as the caller, so row-level security still limits it to their own decks.

create or replace function public.home_summary()
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'balance', public.get_earnings(),
    'decks', coalesce((
      select jsonb_agg(
               to_jsonb(d) || jsonb_build_object('card_count', coalesce(c.n, 0), 'due_count', coalesce(c.due, 0))
               order by d.created_at desc)
      from public.decks d
      left join (
        select deck_id, count(*) as n, count(*) filter (where due_at <= now()) as due
        from public.cards
        group by deck_id
      ) c on c.deck_id = d.id
      where d.deckbox_id is null
    ), '[]'::jsonb),
    'boxes', coalesce((
      select jsonb_agg(
               to_jsonb(b) || jsonb_build_object('deck_count', (select count(*) from public.decks x where x.deckbox_id = b.id))
               order by b.created_at desc)
      from public.deckboxes b
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.home_summary() from public, anon;
grant execute on function public.home_summary() to authenticated;

-- To check the running balance matches the slow sum (should return no rows):
--   select t.user_id, t.balance from public.user_totals t
--   where t.balance <> coalesce((select sum(coins_earned) from public.reviews where user_id = t.user_id), 0)
--                    + coalesce((select sum(amount) from public.earnings_grants where user_id = t.user_id), 0)
--                    - coalesce((select sum(cost) from public.pulls where user_id = t.user_id), 0);
