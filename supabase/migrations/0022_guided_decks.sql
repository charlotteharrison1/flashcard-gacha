-- Guided decks: the "Start Here" tutorial deck keeps its cards in a fixed order (never shuffled, even inside a
-- deckbox) and each card is due once and only once. Rating buttons and coins work as normal, but after a card's
-- first review the database parks it 100 years out, so it never comes back and can't be farmed for coins.
-- Run once in Supabase Dashboard > SQL Editor, AFTER 0020. It also redefines create_tutorial_deck so new
-- signups get a guided deck. The card text below is the edited tutorial text.
-- Then run seed_tutorial_for_existing_users.sql to replace existing decks.

alter table public.decks add column if not exists guided boolean not null default false;

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

create or replace function public.create_tutorial_deck(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
-- Tagged ($fn$) rather than plain $$, because the card text below contains $$ for block maths.
as $fn$
declare
  v_deck_id uuid;
  v_star text := 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMjgiIGZpbGw9IiNmZmMyMzMiIHN0cm9rZT0iIzBhMTIxOCIgc3Ryb2tlLXdpZHRoPSI0Ii8+PHBhdGggZD0iTTMyIDE0bDUgMTEgMTIgMi05IDggMyAxMi0xMS02LTExIDYgMy0xMi05LTggMTItMnoiIGZpbGw9IiNmZmYzYjgiIHN0cm9rZT0iIzBhMTIxOCIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+';
begin
  insert into public.decks (user_id, name, guided)
  values (p_user_id, 'Start Here', true)
  returning id into v_deck_id;

  insert into public.cards (deck_id, user_id, front, back, font, due_at) values
    (v_deck_id, p_user_id,
     '==Welcome to Tyche==.'|| E'\n\n' || ' This is a flashcard' || E'\n\n' || 'The question appears here. Click it, or press **space**, to see the answer.',
     'For each card, rate how difficult it was to answer between 1 and 4.'|| E'\n\n' || 'Only rate it good if the answer came to you quickly.' || E'\n\n' || 'Tyche uses spaced repititon to make you review cards at the optimal times to commit them to long term memory.',
     'clear', now() - interval '99 seconds'),

    (v_deck_id, p_user_id,
     'Card text can be formatted:' || E'\n\n' || '**bold**, *italic*, ==highlight==, and # headings.',
     'Math works too - inline like $x^2+y^2=z^2$, or on its own line:' || E'\n\n' || '$$\int_0^1 x\,dx = \tfrac12$$ Enclose text between `$` or `$$` to trigger math',
     'clear', now() - interval '98 seconds'),

    (v_deck_id, p_user_id,
     'There are lots of ways to customise your cards',
     ' You can add code snippets ```print("hello Tyche")```' || E'\n\n' || 'Or pictures ![a small gold star](' || v_star || ')',
     'clear', now() - interval '97 seconds'),

    (v_deck_id, p_user_id,
     'During study you can do more than rate a card.' || E'\n\n' || 'What are Edit, Skip, Suspend, star and tag for?',
     '**Edit** fixes the card on the spot.' || E'\n\n' || '**Skip** puts it back later in this round.' || E'\n\n' || '**Suspend** hides it until tomorrow.' || E'\n\n' ||  'Use ==stars== and ==tags== for organisation, or to study just those cards later.',
     'clear', now() - interval '96 seconds'),

    (v_deck_id, p_user_id,
     'Decks can live inside a **deckbox** — a folder of decks.',
     'Studying a deckbox shuffles every deck inside it together into one session, instead of studying each deck on its own. You can still study each deck independently. Use this to organise your decks!',
     'clear', now() - interval '95 seconds'),

    (v_deck_id, p_user_id,
     'Every card you get right pays out coins. Harder cards earn more coins',
     'Spend them on the **Pull** screen.',
     'clear', now() - interval '94 seconds'),

    (v_deck_id, p_user_id,
     'Already have cards elsewhere?' || E'\n\n' || 'Any deck page can **import from a CSV or text file**.',
     '.csv, .tsv and .txt all work, including Anki''s plain-text export.',
     'clear', now() - interval '93 seconds'),

    (v_deck_id, p_user_id,
     'Use a preset deck, make your own cards, or import old cards to get started' ,
     'Tutorial finished.',
     'clear', now() - interval '92 seconds');
end;
$fn$;

revoke all on function public.create_tutorial_deck(uuid) from public, anon, authenticated;
