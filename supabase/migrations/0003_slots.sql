-- Slot-machine pulls, tracked winnings, and earnings grants.
-- Run once in Supabase Dashboard > SQL Editor, AFTER 0001 and 0002.

-- 1. Grants: lets you credit a user with extra earnings. No RLS policies on purpose,
--    so the API can't touch it; only the SQL editor (see supabase/grant_coins.sql) can insert.
create table public.earnings_grants (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  amount     int not null check (amount > 0),
  note       text,
  created_at timestamptz not null default now()
);
alter table public.earnings_grants enable row level security;

-- 2. Every pull now records what it won.
alter table public.pulls
  add column result text not null default 'nothing'
  check (result in ('nothing', 'silver', 'gold'));

-- 3. Earnings = reviews + grants - pull costs.
create or replace function public.get_earnings()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select (select count(*) from public.reviews where user_id = auth.uid())::int
       + (select coalesce(sum(amount), 0) from public.earnings_grants where user_id = auth.uid())::int
       - (select coalesce(sum(cost), 0) from public.pulls where user_id = auth.uid())::int;
$$;

-- 4. spend_pull now rolls the odds and returns { balance, result }.
--    Odds: 1% gold, 9% silver, 90% nothing. Return type changed, so drop first.
drop function if exists public.spend_pull();

create function public.spend_pull()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pull_cost constant int := 10;
  balance int;
  roll double precision;
  outcome text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  -- One spend at a time per user, so two fast clicks can't overdraw.
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));

  balance := public.get_earnings();
  if balance < pull_cost then
    raise exception 'not enough earnings';
  end if;

  roll := random();
  outcome := case
    when roll < 0.01 then 'gold'
    when roll < 0.10 then 'silver'
    else 'nothing'
  end;

  insert into public.pulls (user_id, cost, result) values (auth.uid(), pull_cost, outcome);
  return jsonb_build_object('balance', balance - pull_cost, 'result', outcome);
end;
$$;

-- 5. Winnings totals for the pull screen.
create or replace function public.get_winnings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'pulls',  count(*),
    'silver', count(*) filter (where result = 'silver'),
    'gold',   count(*) filter (where result = 'gold')
  )
  from public.pulls
  where user_id = auth.uid();
$$;

revoke all on function public.get_earnings() from public, anon;
revoke all on function public.spend_pull() from public, anon;
revoke all on function public.get_winnings() from public, anon;
grant execute on function public.get_earnings() to authenticated;
grant execute on function public.spend_pull() to authenticated;
grant execute on function public.get_winnings() to authenticated;
