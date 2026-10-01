-- A 10 (or more) pull batch always contains at least one silver or gold.
-- Run once in Supabase Dashboard > SQL Editor, after 0004_bulk_pulls.sql.
-- Same signature as before, so this replaces spend_pulls in place.

create or replace function public.spend_pulls(p_count int)
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
  results text[] := '{}';
  i int;
  lucky_idx int;
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
    results := results || (case
      when roll < 0.01 then 'gold'
      when roll < 0.10 then 'silver'
      else 'nothing'
    end);
  end loop;

  -- Pity rule: a pack of 10+ always lands at least one silver or better.
  if p_count >= 10 and not exists (select 1 from unnest(results) r where r in ('silver', 'gold')) then
    lucky_idx := 1 + floor(random() * p_count)::int;
    results[lucky_idx] := 'silver';
  end if;

  for i in 1..p_count loop
    insert into public.pulls (user_id, cost, result) values (auth.uid(), pull_cost, results[i]);
  end loop;

  return jsonb_build_object('balance', balance - total, 'results', to_jsonb(results));
end;
$$;
