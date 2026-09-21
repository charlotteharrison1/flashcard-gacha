-- Pulls now cost 1 coin each and can be bought in bulk (1 or up to 10 at a time).
-- Run once in Supabase Dashboard > SQL Editor, AFTER 0003_slots.sql.
--
-- Odds are unchanged: 1% gold, 9% silver, 90% nothing, rolled per pull in the database.
-- Keep PULL_COST in src/lib/earnings.ts in sync with pull_cost below.
-- Past pulls keep the cost they were bought at (10 each), so existing balances stay correct.

drop function if exists public.spend_pull();

create function public.spend_pulls(p_count int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pull_cost constant int := 1;
  total int;
  balance int;
  roll double precision;
  outcome text;
  results text[] := '{}';
  i int;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_count is null or p_count < 1 or p_count > 10 then
    raise exception 'invalid pull count';
  end if;

  -- One spend at a time per user, so two fast clicks can't overdraw.
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));

  total := pull_cost * p_count;
  balance := public.get_earnings();
  if balance < total then
    raise exception 'not enough earnings';
  end if;

  for i in 1..p_count loop
    roll := random();
    outcome := case
      when roll < 0.01 then 'gold'
      when roll < 0.10 then 'silver'
      else 'nothing'
    end;
    results := results || outcome;
    insert into public.pulls (user_id, cost, result) values (auth.uid(), pull_cost, outcome);
  end loop;

  return jsonb_build_object('balance', balance - total, 'results', to_jsonb(results));
end;
$$;

revoke all on function public.spend_pulls(int) from public, anon;
grant execute on function public.spend_pulls(int) to authenticated;
