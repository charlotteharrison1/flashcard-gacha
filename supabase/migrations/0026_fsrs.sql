-- FSRS-5 scheduling, and coins that depend on how hard a card has been for you.
-- Run once in Supabase Dashboard > SQL Editor, after 0025. Replaces review_card() and spend_pulls() in place.
--
-- Scheduling: each card now carries FSRS memory state: stability (days until recall odds fall to 90%),
-- difficulty (1-10) and when it was last reviewed. The next due date is when recall odds hit 90%.
-- The old SM-2 columns (ease, interval_days, repetitions) are kept and still updated, so this can be rolled back.
--
-- Coins (whole numbers, 1-4 for a correct answer, 0 for Again): 1 + round(3 * (0.7 * difficulty + 0.3 * forgetting)),
-- where difficulty is the card's 1-10 score BEFORE this answer (rescaled to 0-1) and forgetting is 1 - the odds you
-- would have recalled it now. Hard, Good and Easy pay the same, so there is no reason to misrate. Cards not yet due
-- still pay nothing, as before. Averages about 2 coins a review, about 106 per 50 reviews.
--
-- Pulls now cost 10 coins each (10 pulls = 100 coins), so a 50-card session buys about 10 pulls.
-- Keep PULL_COST in src/lib/earnings.ts in sync with pull_cost below.
-- Everyone's existing balance is multiplied by 10 (one grant) so it still buys the same number of pulls.

alter table public.cards add column stability double precision check (stability > 0);
alter table public.cards add column difficulty double precision check (difficulty between 1 and 10);
alter table public.cards add column last_reviewed_at timestamptz;

-- Cards already studied: stability = their current interval, difficulty from their ease (2.5 -> 5.3, 1.3 -> 10).
update public.cards
set stability = greatest(interval_days, 1),
    difficulty = least(10, greatest(1, 5.3 - 3.9 * (ease::numeric::double precision - 2.5))),
    last_reviewed_at = due_at - make_interval(days => interval_days)
where repetitions > 0;

create or replace function public.review_card(p_card_id uuid, p_rating int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- FSRS-5 default weights (w[1] is w0 in the paper) and the retention the next due date aims for.
  w constant double precision[] := array[
    0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192,
    1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
  retention constant double precision := 0.9;
  c public.cards%rowtype;
  g int := p_rating + 1;            -- FSRS grade: 1 again, 2 hard, 3 good, 4 easy
  v_new boolean;
  v_t double precision;             -- days since the last review
  v_r double precision := 0.9;      -- recall odds right now (a new card has no history: assume 0.9)
  v_dpre double precision;          -- difficulty before this answer
  v_d double precision;
  v_s double precision;
  v_interval int;
  v_reps int;
  v_lapses int;
  v_due timestamptz;
  v_coins int := 0;
  v_guided boolean;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_rating is null or p_rating < 0 or p_rating > 3 then
    raise exception 'invalid rating';
  end if;

  select * into c from public.cards where id = p_card_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'card not found';
  end if;

  v_new := c.stability is null;
  if v_new then
    v_dpre := w[5] - exp(w[6] * 2) + 1; -- the difficulty a first "Good" would give
    v_s := w[g];
    v_d := w[5] - exp(w[6] * (g - 1)) + 1;
  else
    v_t := greatest(extract(epoch from now() - c.last_reviewed_at) / 86400, 0);
    v_r := power(1 + (19.0 / 81) * v_t / c.stability, -0.5);
    v_dpre := c.difficulty;
    v_d := c.difficulty + (-w[7] * (g - 3)) * (10 - c.difficulty) / 9;
    v_d := w[8] * (w[5] - exp(w[6] * 3) + 1) + (1 - w[8]) * v_d; -- pulled back toward the "Easy" starting difficulty
    if v_t < 1 then
      v_s := c.stability * exp(w[18] * (g - 3 + w[19])); -- a repeat within the same day
    elsif g = 1 then
      v_s := least(c.stability, w[12] * power(c.difficulty, -w[13]) * (power(c.stability + 1, w[14]) - 1) * exp(w[15] * (1 - v_r)));
    else
      v_s := c.stability * (1 + exp(w[9]) * (11 - c.difficulty) * power(c.stability, -w[10]) * (exp(w[11] * (1 - v_r)) - 1)
             * case g when 2 then w[16] when 4 then w[17] else 1 end);
    end if;
  end if;
  v_d := least(10, greatest(1, v_d));
  v_s := greatest(0.01, v_s);

  if p_rating = 0 then
    v_interval := 0;
    v_reps := 0;
    v_lapses := c.lapses + 1;
    v_due := now() + interval '10 minutes';
  else
    v_coins := 1 + round(3 * (0.7 * (v_dpre - 1) / 9 + 0.3 * (1 - v_r)))::int;
    v_reps := c.repetitions + 1;
    v_lapses := 0;
    v_interval := least(36500, greatest(1, round(v_s / (19.0 / 81) * (power(retention, -2) - 1))::int));
    v_due := now() + make_interval(days => v_interval);
  end if;

  -- Guided deck (the tutorial): due once and only once, so park it far in the future whatever the rating.
  select guided into v_guided from public.decks where id = c.deck_id;
  if v_guided then
    v_due := now() + interval '100 years';
  end if;

  -- Not due yet (and not a quick retry): reschedule as normal, but pay nothing.
  if c.due_at > now() + interval '10 minutes' then
    v_coins := 0;
  end if;

  update public.cards
  set stability = v_s, difficulty = v_d, last_reviewed_at = now(),
      interval_days = v_interval, repetitions = v_reps, lapses = v_lapses, due_at = v_due
  where id = c.id;

  insert into public.reviews (card_id, user_id, rating, coins_earned)
  values (c.id, auth.uid(), p_rating, v_coins);

  return jsonb_build_object(
    'coins', v_coins,
    'ease', c.ease,
    'interval_days', v_interval,
    'repetitions', v_reps,
    'lapses', v_lapses,
    'due_at', v_due
  );
end;
$$;

revoke all on function public.review_card(uuid, int) from public, anon;
grant execute on function public.review_card(uuid, int) to authenticated;

-- Pulls now cost 10 coins. Give everyone 9x their current balance so it still buys the same number of pulls.
insert into public.earnings_grants (user_id, amount, note)
select user_id, 9 * balance, 'balance x10 when pulls started costing 10 coins'
from (
  select u.id as user_id,
         (select coalesce(sum(coins_earned), 0) from public.reviews where user_id = u.id)
         + (select coalesce(sum(amount), 0) from public.earnings_grants where user_id = u.id)
         - (select coalesce(sum(cost), 0) from public.pulls where user_id = u.id) as balance
  from auth.users u
) b
where balance > 0;

create or replace function public.spend_pulls(p_count int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pull_cost constant int := 10;
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

revoke all on function public.spend_pulls(int) from public, anon;
grant execute on function public.spend_pulls(int) to authenticated;
