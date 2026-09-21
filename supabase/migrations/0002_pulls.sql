-- Earnings + pulls. Run once in Supabase Dashboard > SQL Editor (after 0001_init.sql).
--
-- Earnings = 1 per review ever recorded, minus the cost of every pull spent.
-- The cost lives in spend_pull() so the client can't spoof it.
-- Keep PULL_COST in src/lib/earnings.ts in sync with pull_cost below.

create table public.pulls (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cost       int not null check (cost > 0),
  created_at timestamptz not null default now()
);

create index pulls_user_idx on public.pulls (user_id, created_at desc);

alter table public.pulls enable row level security;

-- Users can read their own pulls. There is deliberately no insert policy:
-- rows are only created by spend_pull() below.
create policy "pulls: read own" on public.pulls
  for select using (user_id = auth.uid());

create or replace function public.get_earnings()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select (select count(*) from public.reviews where user_id = auth.uid())::int
       - (select coalesce(sum(cost), 0) from public.pulls where user_id = auth.uid())::int;
$$;

create or replace function public.spend_pull()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  pull_cost constant int := 10;
  balance int;
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

  insert into public.pulls (user_id, cost) values (auth.uid(), pull_cost);
  return balance - pull_cost;
end;
$$;

revoke all on function public.get_earnings() from public, anon;
revoke all on function public.spend_pull() from public, anon;
grant execute on function public.get_earnings() to authenticated;
grant execute on function public.spend_pull() to authenticated;
