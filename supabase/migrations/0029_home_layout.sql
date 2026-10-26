-- "Edit homepage": decks and deckboxes can be dragged into any order. Run once in Supabase Dashboard >
-- SQL Editor, after 0028. Until it's run, the homepage keeps its default order and saving a new order
-- shows an error hint.
alter table public.decks add column if not exists home_order int;
alter table public.deckboxes add column if not exists home_order int;

-- Saves a whole arrangement in one request: p_items is a list like
--   [{"kind":"deck","id":"<uuid>","ord":0}, {"kind":"box","id":"<uuid>","ord":1}, ...]
-- Runs as the caller, so row-level security only lets you reorder your own decks and boxes.
create or replace function public.save_home_order(p_items jsonb)
returns void
language sql
set search_path = public
as $$
  update public.decks d set home_order = x.ord
  from jsonb_to_recordset(p_items) as x(kind text, id uuid, ord int)
  where x.kind = 'deck' and d.id = x.id;

  update public.deckboxes b set home_order = x.ord
  from jsonb_to_recordset(p_items) as x(kind text, id uuid, ord int)
  where x.kind = 'box' and b.id = x.id;
$$;
revoke all on function public.save_home_order(jsonb) from public, anon;
grant execute on function public.save_home_order(jsonb) to authenticated;
