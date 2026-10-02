-- Reviews are now recorded by the database, which works out the coins itself.
-- Before this, the browser told the database how many coins a review earned, so anyone signed in
-- could claim any number. Run once in Supabase Dashboard > SQL Editor, after 0011.
--
-- This is step 1 of 2 and is safe to run on its own: it only adds a function, so the current
-- app keeps working. Deploy the app update that calls review_card(), THEN run 0013 to lock the
-- old direct writes.
--
-- This is the single source of truth for scheduling and coins. The rules (simplified SM-2, coins
-- = 1 + Again answers since the last success, capped at 5, Again earns nothing) match what
-- src/lib/scheduler.ts used to do in the browser.
--
-- Coins are only paid for cards that are due, or inside the 10-minute retry window after an
-- Again. Studying a card ahead of schedule ("Study anyway") still reschedules it but earns 0.

create or replace function public.review_card(p_card_id uuid, p_rating int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.cards%rowtype;
  v_ease double precision;
  v_interval int;
  v_reps int;
  v_lapses int;
  v_due timestamptz;
  v_coins int := 0;
  v_mult double precision;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_rating is null or p_rating < 0 or p_rating > 3 then
    raise exception 'invalid rating';
  end if;

  -- Brake for scripts: nobody rates more than about one card a second.
  if (
    select count(*) from public.reviews
    where user_id = auth.uid() and reviewed_at > now() - interval '1 minute'
  ) >= 60 then
    raise exception 'slow down';
  end if;

  select * into c from public.cards where id = p_card_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'card not found';
  end if;

  if p_rating = 0 then
    v_ease := greatest(1.3::double precision, c.ease::numeric::double precision - 0.2);
    v_interval := 0;
    v_reps := 0;
    v_lapses := c.lapses + 1;
    v_due := now() + interval '10 minutes';
  else
    v_coins := 1 + least(c.lapses, 4);
    v_reps := c.repetitions + 1;
    v_ease := greatest(
      1.3::double precision,
      c.ease::numeric::double precision + case p_rating when 1 then -0.15 when 3 then 0.15 else 0 end
    );
    v_interval := c.interval_days;
    if v_reps = 1 then
      v_interval := case when p_rating = 3 then 3 else 1 end;
    elsif v_reps = 2 then
      v_interval := case when p_rating = 3 then 6 else 3 end;
    else
      v_mult := case p_rating when 1 then 1.2 when 2 then v_ease else v_ease * 1.3 end;
      v_interval := greatest(c.interval_days + 1, floor(c.interval_days * v_mult + 0.5)::int);
    end if;
    v_lapses := 0;
    v_due := now() + make_interval(days => v_interval);
  end if;

  -- Not due yet (and not a quick retry): reschedule as normal, but pay nothing.
  if c.due_at > now() + interval '10 minutes' then
    v_coins := 0;
  end if;

  update public.cards
  set ease = v_ease, interval_days = v_interval, repetitions = v_reps, lapses = v_lapses, due_at = v_due
  where id = c.id;

  insert into public.reviews (card_id, user_id, rating, coins_earned)
  values (c.id, auth.uid(), p_rating, v_coins);

  return jsonb_build_object(
    'coins', v_coins,
    'ease', v_ease,
    'interval_days', v_interval,
    'repetitions', v_reps,
    'lapses', v_lapses,
    'due_at', v_due
  );
end;
$$;

revoke all on function public.review_card(uuid, int) from public, anon;
grant execute on function public.review_card(uuid, int) to authenticated;
