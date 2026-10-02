-- Step 2 of 2: stop the browser writing reviews and scheduling fields directly.
-- Run in Supabase Dashboard > SQL Editor ONLY AFTER the app that calls review_card() (0012) is
-- deployed. Running it earlier breaks studying for anyone on the old app.
--
-- After this, the only way to earn coins is review_card(), which works the coins out itself.

-- reviews: readable by their owner, written only by review_card().
drop policy if exists "reviews: own rows" on public.reviews;
create policy "reviews: read own" on public.reviews
  for select using (user_id = auth.uid());
revoke insert, update, delete on public.reviews from anon, authenticated;

-- cards: the API may still add cards and edit their text, but can't set scheduling fields
-- (ease, interval_days, repetitions, lapses, due_at), which feed the coin payout.
revoke insert, update on public.cards from anon, authenticated;
grant insert (deck_id, front, back, source, font) on public.cards to authenticated;
grant update (front, back, font) on public.cards to authenticated;
