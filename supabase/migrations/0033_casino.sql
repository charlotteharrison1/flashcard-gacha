-- "Pick your poison": coin games you can play while studying. Run once in Supabase Dashboard > SQL Editor, after 0032.
--
-- Every game is decided here, in the database, never in the browser. Bets come out of your coin balance (user_totals, see 0027)
-- the moment they're placed and winnings go back in when the game settles, so a game you walk away from has already cost its bet.
-- Each game has a small house edge so coins can't be farmed:
--   scratch cards  costs 5, pays on three matching symbols (returns about 92.5%)
--   roulette       one zero wheel (0-36): red/black pays 2x (48.6% to win), a single number pays 36x (return 97.3%)
--   dice           roll 1-100, pick over or under a target, pays 97 / chance (return 97%); "double or nothing" is a 48% shot at 2x
--   mines          5x5 grid, pick how many mines; every safe tile raises your multiplier (return 97%); cash out any time
--   blackjack      one fresh deck per hand, blackjack pays 3:2, dealer hits soft 17, you can hit, stand or double (no splits)
-- There is no betting limit except your balance.

create table if not exists public.casino_ledger (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  game       text not null,
  delta      bigint not null,
  created_at timestamptz not null default now()
);
alter table public.casino_ledger enable row level security; -- no policies: only the functions below touch it
revoke all on public.casino_ledger from anon, authenticated;
create index if not exists casino_ledger_user on public.casino_ledger (user_id, created_at);

-- Games that take more than one step (mines, blackjack). The hidden parts (mine positions, the deck) live here and are never sent to the browser.
create table if not exists public.casino_games (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  game       text not null check (game in ('mines', 'blackjack')),
  bet        bigint not null,
  state      jsonb not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.casino_games enable row level security;
revoke all on public.casino_games from anon, authenticated;
create unique index if not exists casino_one_open_game on public.casino_games (user_id, game) where active;

-- ---- helpers (not callable from the app) ----------------------------------------------------------------

create or replace function public.casino_move(p_game text, p_delta bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
begin
  insert into public.casino_ledger (user_id, game, delta) values (auth.uid(), p_game, p_delta);
  insert into public.user_totals (user_id, balance) values (auth.uid(), p_delta)
  on conflict (user_id) do update set balance = public.user_totals.balance + excluded.balance
  returning balance into v_balance;
  return v_balance;
end;
$$;

-- Takes a bet out of the balance. One game action at a time per user, and never below zero.
create or replace function public.casino_take(p_game text, p_bet bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_bet is null or p_bet < 1 then
    raise exception 'invalid bet';
  end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select coalesce((select balance from public.user_totals where user_id = auth.uid()), 0) into v_balance;
  if v_balance < p_bet then
    raise exception 'not enough earnings';
  end if;
  return public.casino_move(p_game, -p_bet);
end;
$$;

create or replace function public.casino_balance()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select balance from public.user_totals where user_id = auth.uid()), 0);
$$;

create or replace function public.casino_ints(j jsonb)
returns int[]
language sql
immutable
as $$
  select coalesce(array(select jsonb_array_elements_text(j)::int), '{}');
$$;

revoke all on function public.casino_move(text, bigint), public.casino_take(text, bigint), public.casino_balance(), public.casino_ints(jsonb) from public, anon, authenticated;

-- ---- scratch cards ----------------------------------------------------------------------------------------

-- Pay 5, get nine hidden symbols. Three of a kind wins that symbol's prize. The result is rolled first and the grid built to match.
create or replace function public.scratch_buy()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cost constant int := 5;
  syms constant text[] := array['cherry', 'bell', 'bar', 'diamond', 'seven', 'star'];
  prizes constant int[] := array[10, 15, 25, 50, 100, 250];
  odds constant double precision[] := array[0.16, 0.07, 0.035, 0.012, 0.003, 0.0008]; -- chance of each symbol being the winning one
  roll double precision := random();
  acc double precision := 0;
  win int := 0; -- index of the winning symbol, 0 = no win
  cells int[] := '{}';
  counts int[] := array[0, 0, 0, 0, 0, 0];
  s int;
  i int;
  spots int[];
  grid text[] := array_fill(''::text, array[9]);
  balance bigint;
  prize int := 0;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  perform public.casino_take('scratch', cost);

  for i in 1..6 loop
    acc := acc + odds[i];
    if win = 0 and roll < acc then win := i; end if;
  end loop;

  -- three spots for the winning symbol
  spots := array(select g from generate_series(1, 9) g order by random() limit case when win > 0 then 3 else 0 end);
  if win > 0 then
    foreach i in array spots loop
      grid[i] := syms[win];
    end loop;
    counts[win] := 3;
    prize := prizes[win];
  end if;
  -- every other cell gets a random symbol, none of which may appear three times (so nothing else wins)
  for i in 1..9 loop
    if grid[i] = '' then
      loop
        s := 1 + floor(random() * 6)::int;
        exit when counts[s] < 2 and s <> win;
      end loop;
      counts[s] := counts[s] + 1;
      grid[i] := syms[s];
    end if;
  end loop;

  if prize > 0 then
    balance := public.casino_move('scratch', prize);
  else
    balance := public.casino_balance();
  end if;
  return jsonb_build_object('balance', balance, 'cost', cost, 'cells', to_jsonb(grid), 'prize', prize);
end;
$$;

-- ---- roulette ------------------------------------------------------------------------------------------------

-- One spin of a 0-36 wheel. p_kind is 'red', 'black' or 'number' (p_pick 0-36). Riding your winnings is just another spin with the payout as the bet.
create or replace function public.roulette_spin(p_bet bigint, p_kind text, p_pick int default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  reds constant int[] := array[1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  n int;
  colour text;
  win boolean;
  payout bigint := 0;
  balance bigint;
begin
  if p_kind is null or p_kind not in ('red', 'black', 'number') then raise exception 'invalid bet'; end if;
  if p_kind = 'number' and (p_pick is null or p_pick < 0 or p_pick > 36) then raise exception 'invalid number'; end if;
  perform public.casino_take('roulette', p_bet);

  n := floor(random() * 37)::int;
  colour := case when n = 0 then 'green' when n = any (reds) then 'red' else 'black' end;
  win := case when p_kind = 'number' then n = p_pick else colour = p_kind end;
  if win then
    payout := p_bet * case when p_kind = 'number' then 36 else 2 end;
    balance := public.casino_move('roulette', payout);
  else
    balance := public.casino_balance();
  end if;
  return jsonb_build_object('balance', balance, 'number', n, 'colour', colour, 'win', win, 'bet', p_bet, 'payout', payout);
end;
$$;

-- ---- dice ---------------------------------------------------------------------------------------------------

-- Roll 1-100. "under N" wins on a roll below N, "over N" wins on a roll above N. The payout is 97 / chance, rounded down.
-- p_double = true is "double or nothing": a flat 48% to win 2x, whatever else is set.
create or replace function public.dice_roll(p_bet bigint, p_over boolean default false, p_target int default 50, p_double boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  roll int;
  chance int;
  win boolean;
  payout bigint := 0;
  balance bigint;
begin
  if p_double then
    chance := 48;
  else
    chance := case when p_over then 100 - p_target else p_target - 1 end;
    if p_target is null or chance < 2 or chance > 95 then raise exception 'invalid target'; end if;
  end if;
  perform public.casino_take('dice', p_bet);

  roll := 1 + floor(random() * 100)::int;
  win := case when p_double then roll <= 48 when p_over then roll > p_target else roll < p_target end;
  if win then
    payout := case when p_double then p_bet * 2 else floor(p_bet * 97.0 / chance)::bigint end;
    balance := public.casino_move('dice', payout);
  else
    balance := public.casino_balance();
  end if;
  return jsonb_build_object('balance', balance, 'roll', roll, 'win', win, 'bet', p_bet, 'payout', payout, 'chance', chance);
end;
$$;

-- ---- mines --------------------------------------------------------------------------------------------------

-- Multiplier after k safe tiles on a 25-tile board with m mines: the fair odds of getting that far, less 3%.
create or replace function public.mines_mult(p_mines int, p_k int)
returns double precision
language plpgsql
immutable
as $$
declare
  m double precision := 0.97;
  i int;
begin
  for i in 0..p_k - 1 loop
    m := m * (25 - i) / (25 - p_mines - i);
  end loop;
  return m;
end;
$$;

create or replace function public.mines_view(g public.casino_games, p_balance bigint, p_reveal boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  revealed int[] := public.casino_ints(g.state -> 'revealed');
  m int := (g.state ->> 'mines_count')::int;
  mult double precision := public.mines_mult(m, coalesce(array_length(revealed, 1), 0));
begin
  return jsonb_build_object(
    'bet', g.bet, 'mines_count', m, 'revealed', to_jsonb(revealed),
    'multiplier', round(mult::numeric, 4), 'payout', floor(g.bet * mult)::bigint, 'balance', p_balance,
    'status', g.state ->> 'status',
    'mines', case when p_reveal then g.state -> 'mines' else null end,
    'hit', g.state -> 'hit');
end;
$$;

create or replace function public.mines_start(p_bet bigint, p_mines int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  gm public.casino_games;
  balance bigint;
begin
  if p_mines is null or p_mines < 1 or p_mines > 24 then raise exception 'invalid mine count'; end if;
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from public.casino_games where user_id = auth.uid() and game = 'mines' and active) then
    raise exception 'finish your current mines game first';
  end if;
  balance := public.casino_take('mines', p_bet);
  insert into public.casino_games (user_id, game, bet, state)
  values (auth.uid(), 'mines', p_bet, jsonb_build_object(
    'status', 'active', 'mines_count', p_mines, 'revealed', '[]'::jsonb,
    'mines', to_jsonb(array(select g from generate_series(0, 24) g order by random() limit p_mines))))
  returning * into gm;
  return public.mines_view(gm, balance);
end;
$$;

create or replace function public.mines_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.casino_games;
begin
  select * into g from public.casino_games where user_id = auth.uid() and game = 'mines' and active;
  if not found then return null; end if;
  return public.mines_view(g, public.casino_balance());
end;
$$;

create or replace function public.mines_reveal(p_cell int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.casino_games;
  mines int[];
  revealed int[];
  m int;
  balance bigint;
begin
  if p_cell is null or p_cell < 0 or p_cell > 24 then raise exception 'invalid tile'; end if;
  select * into g from public.casino_games where user_id = auth.uid() and game = 'mines' and active for update;
  if not found then raise exception 'no game in progress'; end if;
  mines := public.casino_ints(g.state -> 'mines');
  revealed := public.casino_ints(g.state -> 'revealed');
  m := (g.state ->> 'mines_count')::int;
  if p_cell = any (revealed) then raise exception 'tile already open'; end if;

  if p_cell = any (mines) then
    g.state := g.state || jsonb_build_object('status', 'lost', 'hit', p_cell);
    update public.casino_games set state = g.state, active = false where id = g.id;
    return public.mines_view(g, public.casino_balance(), true);
  end if;

  revealed := revealed || p_cell;
  g.state := g.state || jsonb_build_object('revealed', to_jsonb(revealed));
  if array_length(revealed, 1) = 25 - m then
    -- every safe tile found: cash out automatically
    balance := public.casino_move('mines', floor(g.bet * public.mines_mult(m, 25 - m))::bigint);
    g.state := g.state || jsonb_build_object('status', 'cleared');
    update public.casino_games set state = g.state, active = false where id = g.id;
    return public.mines_view(g, balance, true);
  end if;
  update public.casino_games set state = g.state where id = g.id;
  return public.mines_view(g, public.casino_balance());
end;
$$;

create or replace function public.mines_cashout()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.casino_games;
  revealed int[];
  m int;
  balance bigint;
begin
  select * into g from public.casino_games where user_id = auth.uid() and game = 'mines' and active for update;
  if not found then raise exception 'no game in progress'; end if;
  revealed := public.casino_ints(g.state -> 'revealed');
  m := (g.state ->> 'mines_count')::int;
  if coalesce(array_length(revealed, 1), 0) = 0 then raise exception 'open a tile first'; end if;
  balance := public.casino_move('mines', floor(g.bet * public.mines_mult(m, array_length(revealed, 1)))::bigint);
  g.state := g.state || jsonb_build_object('status', 'cashed');
  update public.casino_games set state = g.state, active = false where id = g.id;
  return public.mines_view(g, balance, true);
end;
$$;

-- ---- blackjack ------------------------------------------------------------------------------------------------
-- Cards are 0-51: rank = card % 13 (0 ace, 1-8 two to nine, 9-12 ten/jack/queen/king), suit = card / 13.

create or replace function public.bj_hand(p_cards int[], out total int, out soft boolean)
language plpgsql
immutable
as $$
declare
  c int;
  aces int := 0;
begin
  total := 0;
  foreach c in array p_cards loop
    if c % 13 = 0 then aces := aces + 1; total := total + 1;
    elsif c % 13 >= 9 then total := total + 10;
    else total := total + (c % 13) + 1;
    end if;
  end loop;
  soft := false;
  if aces > 0 and total + 10 <= 21 then
    total := total + 10;
    soft := true;
  end if;
end;
$$;

-- What the browser may see. While the hand is live only the dealer's first card is shown.
create or replace function public.bj_view(g public.casino_games, p_balance bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  player int[] := public.casino_ints(g.state -> 'player');
  dealer int[] := public.casino_ints(g.state -> 'dealer');
  done boolean := g.state ->> 'result' is not null;
begin
  return jsonb_build_object(
    'bet', g.bet, 'balance', p_balance,
    'player', to_jsonb(player), 'player_total', (public.bj_hand(player)).total,
    'dealer', to_jsonb(case when done then dealer else dealer[1:1] end),
    'dealer_total', case when done then (public.bj_hand(dealer)).total else null end,
    'result', g.state ->> 'result', 'payout', coalesce((g.state ->> 'payout')::bigint, 0),
    'can_double', not done and array_length(player, 1) = 2);
end;
$$;

-- Plays out the dealer's hand and settles the bet. `g.state` must hold deck, player, dealer.
create or replace function public.bj_settle(g public.casino_games, p_dealer_plays boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deck int[] := public.casino_ints(g.state -> 'deck');
  player int[] := public.casino_ints(g.state -> 'player');
  dealer int[] := public.casino_ints(g.state -> 'dealer');
  p record;
  d record;
  result text;
  payout bigint := 0;
  balance bigint;
begin
  p := public.bj_hand(player);
  if p_dealer_plays and p.total <= 21 then
    loop
      d := public.bj_hand(dealer);
      exit when d.total > 17 or (d.total = 17 and not d.soft);
      dealer := dealer || deck[1];
      deck := deck[2:];
    end loop;
  end if;
  d := public.bj_hand(dealer);

  if p.total > 21 then result := 'bust';
  elsif p.total = 21 and array_length(player, 1) = 2 and not (d.total = 21 and array_length(dealer, 1) = 2) and (g.state ->> 'doubled') is null then
    result := 'blackjack';
    payout := g.bet + g.bet + g.bet / 2; -- the bet back, plus 3:2 (rounded down)
  elsif d.total = 21 and array_length(dealer, 1) = 2 and not (p.total = 21 and array_length(player, 1) = 2) then result := 'lose';
  elsif d.total > 21 or p.total > d.total then
    result := 'win';
    payout := g.bet * 2;
  elsif p.total = d.total then
    result := 'push';
    payout := g.bet;
  else
    result := 'lose';
  end if;

  if payout > 0 then
    balance := public.casino_move('blackjack', payout);
  else
    balance := public.casino_balance();
  end if;
  g.state := g.state || jsonb_build_object('deck', to_jsonb(deck), 'dealer', to_jsonb(dealer), 'result', result, 'payout', payout);
  update public.casino_games set state = g.state, active = false where id = g.id;
  return public.bj_view(g, balance);
end;
$$;

create or replace function public.bj_deal(p_bet bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deck int[] := array(select g from generate_series(0, 51) g order by random());
  player int[];
  dealer int[];
  gm public.casino_games;
  balance bigint;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from public.casino_games where user_id = auth.uid() and game = 'blackjack' and active) then
    raise exception 'finish your current hand first';
  end if;
  balance := public.casino_take('blackjack', p_bet);
  player := array[deck[1], deck[3]];
  dealer := array[deck[2], deck[4]];
  deck := deck[5:];
  insert into public.casino_games (user_id, game, bet, state)
  values (auth.uid(), 'blackjack', p_bet, jsonb_build_object('deck', to_jsonb(deck), 'player', to_jsonb(player), 'dealer', to_jsonb(dealer)))
  returning * into gm;
  -- a natural 21 on either side ends the hand straight away
  if (public.bj_hand(player)).total = 21 or (public.bj_hand(dealer)).total = 21 then
    return public.bj_settle(gm, false);
  end if;
  return public.bj_view(gm, balance);
end;
$$;

create or replace function public.bj_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.casino_games;
begin
  select * into g from public.casino_games where user_id = auth.uid() and game = 'blackjack' and active;
  if not found then return null; end if;
  return public.bj_view(g, public.casino_balance());
end;
$$;

-- action: 'hit', 'stand' or 'double'
create or replace function public.bj_act(p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.casino_games;
  deck int[];
  player int[];
  p record;
  balance bigint;
begin
  if p_action not in ('hit', 'stand', 'double') then raise exception 'invalid action'; end if;
  select * into g from public.casino_games where user_id = auth.uid() and game = 'blackjack' and active for update;
  if not found then raise exception 'no hand in progress'; end if;
  deck := public.casino_ints(g.state -> 'deck');
  player := public.casino_ints(g.state -> 'player');

  if p_action = 'stand' then
    return public.bj_settle(g, true);
  end if;

  if p_action = 'double' then
    if array_length(player, 1) <> 2 then raise exception 'you can only double on your first two cards'; end if;
    perform public.casino_take('blackjack', g.bet); -- a second bet of the same size
    g.bet := g.bet * 2;
    update public.casino_games set bet = g.bet where id = g.id;
    player := player || deck[1];
    deck := deck[2:];
    g.state := g.state || jsonb_build_object('deck', to_jsonb(deck), 'player', to_jsonb(player), 'doubled', true);
    return public.bj_settle(g, true);
  end if;

  -- hit
  player := player || deck[1];
  deck := deck[2:];
  g.state := g.state || jsonb_build_object('deck', to_jsonb(deck), 'player', to_jsonb(player));
  p := public.bj_hand(player);
  if p.total >= 21 then
    return public.bj_settle(g, true); -- bust ends the hand; 21 stands automatically
  end if;
  update public.casino_games set state = g.state where id = g.id;
  return public.bj_view(g, public.casino_balance());
end;
$$;

-- ---- permissions ----------------------------------------------------------------------------------------------

revoke all on function public.scratch_buy(), public.roulette_spin(bigint, text, int), public.dice_roll(bigint, boolean, int, boolean),
  public.mines_start(bigint, int), public.mines_state(), public.mines_reveal(int), public.mines_cashout(),
  public.bj_deal(bigint), public.bj_state(), public.bj_act(text) from public, anon;
grant execute on function public.scratch_buy(), public.roulette_spin(bigint, text, int), public.dice_roll(bigint, boolean, int, boolean),
  public.mines_start(bigint, int), public.mines_state(), public.mines_reveal(int), public.mines_cashout(),
  public.bj_deal(bigint), public.bj_state(), public.bj_act(text) to authenticated;
revoke all on function public.mines_mult(int, int), public.mines_view(public.casino_games, bigint, boolean),
  public.bj_hand(int[]), public.bj_view(public.casino_games, bigint), public.bj_settle(public.casino_games, boolean) from public, anon, authenticated;
