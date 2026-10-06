-- The Library: preset decks anyone can preview and "take" onto their home screen.
-- Run once in Supabase Dashboard > SQL Editor, after 0022.
--
-- Add or edit preset decks in Dashboard > Table Editor (library_decks / library_cards), or with SQL.
-- Every signed-in account can read them; nobody can change them from the app.
--   library_decks: slug (unique, used in the URL), name, subject, description, color (0-5), logo
--                  (one of the 0021 logo names), guided (true = fixed order, each card due once only), sort.
--   library_cards: library_deck_id, position (1, 2, 3...: the order), front, back, font.

create table if not exists public.library_decks (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  subject     text not null default '',
  description text not null default '',
  color       int check (color between 0 and 5),
  logo        text check (logo in ('spade','heart','club','suitDiamond','star','cherry','seven','bar','diamond','bell','coin')),
  guided      boolean not null default false,
  sort        int not null default 100,
  created_at  timestamptz not null default now()
);

create table if not exists public.library_cards (
  id              uuid primary key default gen_random_uuid(),
  library_deck_id uuid not null references public.library_decks(id) on delete cascade,
  position        int not null,
  front           text not null,
  back            text not null,
  font            text not null default 'clear'
);
create index if not exists library_cards_deck_idx on public.library_cards (library_deck_id, position);

alter table public.library_decks enable row level security;
alter table public.library_cards enable row level security;
drop policy if exists "library decks readable" on public.library_decks;
drop policy if exists "library cards readable" on public.library_cards;
create policy "library decks readable" on public.library_decks for select to authenticated using (true);
create policy "library cards readable" on public.library_cards for select to authenticated using (true);
revoke all on public.library_decks, public.library_cards from anon;
revoke insert, update, delete on public.library_decks, public.library_cards from authenticated;

-- Copies a preset deck (and its cards) into the caller's own decks and returns the new deck's id.
create or replace function public.take_library_deck(p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  d public.library_decks%rowtype;
  v_deck_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select * into d from public.library_decks where slug = p_slug;
  if not found then
    raise exception 'no such library deck';
  end if;

  insert into public.decks (user_id, name, color, logo, guided)
  values (auth.uid(), d.name, d.color, d.logo, d.guided)
  returning id into v_deck_id;

  -- A guided deck's cards get staggered due times so they come out in their written order.
  insert into public.cards (deck_id, user_id, front, back, font, due_at)
  select v_deck_id, auth.uid(), c.front, c.back, c.font,
         case when d.guided then now() - make_interval(secs => 1000 - c.position) else now() end
  from public.library_cards c
  where c.library_deck_id = d.id
  order by c.position;

  return v_deck_id;
end;
$fn$;

revoke all on function public.take_library_deck(text) from public, anon;
grant execute on function public.take_library_deck(text) to authenticated;

-- ---- The decks on the shelf -------------------------------------------------------------------

-- The tutorial (same cards new accounts get automatically)
do $seed$
declare
  v_id uuid;
  v_star text := 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMjgiIGZpbGw9IiNmZmMyMzMiIHN0cm9rZT0iIzBhMTIxOCIgc3Ryb2tlLXdpZHRoPSI0Ii8+PHBhdGggZD0iTTMyIDE0bDUgMTEgMTIgMi05IDggMyAxMi0xMS02LTExIDYgMy0xMi05LTggMTItMnoiIGZpbGw9IiNmZmYzYjgiIHN0cm9rZT0iIzBhMTIxOCIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+';
begin
  if not exists (select 1 from public.library_decks where slug = 'start-here') then
    insert into public.library_decks (slug, name, subject, description, color, logo, guided, sort)
    values ('start-here', 'Start Here', 'Tutorial', 'A quick tour of how Tyche works: flipping, ratings, formatting, coins and pulls.', 4, 'star', true, 1)
    returning id into v_id;

    insert into public.library_cards (library_deck_id, position, front, back, font) values

    (v_id, 1,
     'This is a flashcard.' || E'\n\n' || 'Click it, or press **space**, to see the answer.',
     'Now click **Good** below — that''s how you rate every card from here on.',
     'clear'),

    (v_id, 2,
     '# Ratings' || E'\n\n' || 'What do **Again**, **Hard**, **Good** and **Easy** actually do?',
     'They schedule when this card comes back: **Again** in a few minutes, the others in days that grow longer each time you get it right. A deck''s **Study options** can also keep the answer on screen instead of flipping.',
     'clear'),

    (v_id, 3,
     'Card text can be formatted:' || E'\n\n' || '**bold**, *italic*, ==highlight==, and # headings.',
     'Math works too — inline like $x^2+y^2=z^2$, or on its own line:' || E'\n\n' || '$$\int_0^1 x\,dx = \tfrac12$$',
     'clear'),

    (v_id, 4,
     'A card can carry a picture.' || E'\n\n' || '![a small gold star](' || v_star || ')',
     'In the card editor, the picture icon drops one in at your cursor — then drag its corner in the preview below the textarea to resize it.',
     'clear'),

    (v_id, 5,
     'During study you can do more than rate a card.' || E'\n\n' || 'What are Edit, Skip, Suspend, star and tag for?',
     '**Edit** fixes the card on the spot. **Skip** puts it back later in this round. **Suspend** hides it until tomorrow. Starring or tagging marks it so you can study just those cards later.',
     'clear'),

    (v_id, 6,
     'Decks can live inside a **deckbox** — a folder of decks.',
     'Studying a deckbox shuffles every deck inside it together into one session, instead of studying each deck on its own.',
     'clear'),

    (v_id, 7,
     'Every card you get right pays out coins — more if it had been giving you trouble.',
     'Spend them on the **Pull** screen: drag the lever for a badge, or load 10 coins for a full-screen reveal. A 10-pull always lands at least one win.',
     'clear'),

    (v_id, 8,
     'Already have cards elsewhere?' || E'\n\n' || 'Any deck page can **import from a CSV or text file**.',
     '.csv, .tsv and .txt all work, including Anki''s plain-text export. That''s the tour — make a deck of your own, or delete this one whenever you''re ready.',
     'clear');
  end if;
end
$seed$;

-- Placeholders: replace these cards with real ones in the Table Editor.
do $seed$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.library_decks where slug = 'mathematics') then
    insert into public.library_decks (slug, name, subject, description, color, logo, sort)
    values ('mathematics', 'Mathematics', 'Maths', 'Placeholder: a maths deck is coming soon.', 1, 'diamond', 10)
    returning id into v_id;
    insert into public.library_cards (library_deck_id, position, front, back) values
      (v_id, 1, 'What is $2 + 2$?', '$4$ (placeholder card)'),
      (v_id, 2, 'What is the derivative of $x^2$?', '$2x$ (placeholder card)');
  end if;

  if not exists (select 1 from public.library_decks where slug = 'physics') then
    insert into public.library_decks (slug, name, subject, description, color, logo, sort)
    values ('physics', 'Physics', 'Physics', 'Placeholder: a physics deck is coming soon.', 5, 'bell', 20)
    returning id into v_id;
    insert into public.library_cards (library_deck_id, position, front, back) values
      (v_id, 1, 'What is Newton''s second law?', '$F = ma$ (placeholder card)'),
      (v_id, 2, 'What is the speed of light, roughly?', '$3 \times 10^8$ m/s (placeholder card)');
  end if;

  if not exists (select 1 from public.library_decks where slug = 'history') then
    insert into public.library_decks (slug, name, subject, description, color, logo, sort)
    values ('history', 'History', 'History', 'Placeholder: a history deck is coming soon.', 3, 'coin', 30)
    returning id into v_id;
    insert into public.library_cards (library_deck_id, position, front, back) values
      (v_id, 1, 'In what year did the Western Roman Empire fall?', '476 AD (placeholder card)'),
      (v_id, 2, 'Who was the first Roman emperor?', 'Augustus (placeholder card)');
  end if;
end
$seed$;
