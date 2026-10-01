-- Coins per review now depend on how hard the card has been: getting a card right after
-- repeated "Again" answers pays more than an easy first-try correct answer. Marking a card
-- Again now earns nothing (before, every review earned a flat 1 coin regardless of rating).
-- Run once in Supabase Dashboard > SQL Editor, after 0005_pull_guarantee.sql.

alter table public.cards add column lapses int not null default 0 check (lapses >= 0);

alter table public.reviews add column coins_earned int not null default 0 check (coins_earned >= 0);

-- Every review made before this migration earned a flat 1 coin under the old rule; keep that
-- value so existing balances don't drop to zero once get_earnings starts reading this column.
update public.reviews set coins_earned = 1 where coins_earned = 0;

create or replace function public.get_earnings()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select (select coalesce(sum(coins_earned), 0) from public.reviews where user_id = auth.uid())::int
       + (select coalesce(sum(amount), 0) from public.earnings_grants where user_id = auth.uid())::int
       - (select coalesce(sum(cost), 0) from public.pulls where user_id = auth.uid())::int;
$$;

revoke all on function public.get_earnings() from public, anon;
grant execute on function public.get_earnings() to authenticated;
