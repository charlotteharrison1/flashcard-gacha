-- Every new account gets a "Start Here" deck that teaches the app by using it. Run once in
-- Supabase Dashboard > SQL Editor, after 0019.
--
-- This only fires on NEW signups (the trigger is on auth.users insert). Accounts created before
-- this migration don't get one retroactively — see seed_tutorial_for_existing_users.sql for that.

create or replace function public.create_tutorial_deck(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deck_id uuid;
  v_star text := 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMjgiIGZpbGw9IiNmZmMyMzMiIHN0cm9rZT0iIzBhMTIxOCIgc3Ryb2tlLXdpZHRoPSI0Ii8+PHBhdGggZD0iTTMyIDE0bDUgMTEgMTIgMi05IDggMyAxMi0xMS02LTExIDYgMy0xMi05LTggMTItMnoiIGZpbGw9IiNmZmYzYjgiIHN0cm9rZT0iIzBhMTIxOCIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+';
begin
  insert into public.decks (user_id, name)
  values (p_user_id, 'Start Here')
  returning id into v_deck_id;

  insert into public.cards (deck_id, user_id, front, back, font) values
    (v_deck_id, p_user_id,
     'This is a flashcard.' || E'\n\n' || 'Click it, or press **space**, to see the answer.',
     'Now click **Good** below — that''s how you rate every card from here on.',
     'clear'),

    (v_deck_id, p_user_id,
     '# Ratings' || E'\n\n' || 'What do **Again**, **Hard**, **Good** and **Easy** actually do?',
     'They schedule when this card comes back: **Again** in a few minutes, the others in days that grow longer each time you get it right. A deck''s **Study options** can also keep the answer on screen instead of flipping.',
     'clear'),

    (v_deck_id, p_user_id,
     'Card text can be formatted:' || E'\n\n' || '**bold**, *italic*, ==highlight==, and # headings.',
     'Math works too — inline like $x^2+y^2=z^2$, or on its own line:' || E'\n\n' || '$$\int_0^1 x\,dx = \tfrac12$$',
     'clear'),

    (v_deck_id, p_user_id,
     'A card can carry a picture.' || E'\n\n' || '![a small gold star](' || v_star || ')',
     'In the card editor, the picture icon drops one in at your cursor — then drag its corner in the preview below the textarea to resize it.',
     'clear'),

    (v_deck_id, p_user_id,
     'During study you can do more than rate a card.' || E'\n\n' || 'What are Edit, Skip, Suspend, star and tag for?',
     '**Edit** fixes the card on the spot. **Skip** puts it back later in this round. **Suspend** hides it until tomorrow. Starring or tagging marks it so you can study just those cards later.',
     'clear'),

    (v_deck_id, p_user_id,
     'Decks can live inside a **deckbox** — a folder of decks.',
     'Studying a deckbox shuffles every deck inside it together into one session, instead of studying each deck on its own.',
     'clear'),

    (v_deck_id, p_user_id,
     'Every card you get right pays out coins — more if it had been giving you trouble.',
     'Spend them on the **Pull** screen: drag the lever for a badge, or load 10 coins for a full-screen reveal. A 10-pull always lands at least one win.',
     'clear'),

    (v_deck_id, p_user_id,
     'Already have cards elsewhere?' || E'\n\n' || 'Any deck page can **import from a CSV or text file**.',
     '.csv, .tsv and .txt all work, including Anki''s plain-text export. That''s the tour — make a deck of your own, or delete this one whenever you''re ready.',
     'clear');
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Caught so a tutorial-deck hiccup can never block someone's actual signup.
  begin
    perform public.create_tutorial_deck(new.id);
  exception when others then
    raise warning 'create_tutorial_deck failed for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
