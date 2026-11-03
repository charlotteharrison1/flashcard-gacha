-- How many brand-new cards you've started today, for the daily new-card limit (NEW_CARDS_PER_DAY in
-- src/lib/dailyLimit.ts). Run once in Supabase Dashboard > SQL Editor. Until it's run, the app still caps
-- each study session at the daily limit of new cards, it just can't count cards you started earlier today.
--
-- A card is "started today" when its very first review was at or after p_since (the browser passes the start of
-- the user's day). Runs as the caller, so it only ever counts their own reviews.
create or replace function public.new_cards_today(p_since timestamptz)
returns int
language sql
stable
set search_path = public
as $$
  select count(*)::int
  from (
    select r.card_id
    from public.reviews r
    where r.card_id in (select card_id from public.reviews where user_id = (select auth.uid()) and reviewed_at >= p_since)
    group by r.card_id
    having min(r.reviewed_at) >= p_since
  ) started;
$$;
revoke all on function public.new_cards_today(timestamptz) from public, anon;
grant execute on function public.new_cards_today(timestamptz) to authenticated;
