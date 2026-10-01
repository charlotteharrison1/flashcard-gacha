-- Images now live inline in the card text (as ![](url)), not in a separate field.
-- Existing attached pictures are preserved by appending them to the front text as inline images.
-- Run once in Supabase Dashboard > SQL Editor, after 0009_card_font.sql.

update public.cards
set front = front || E'\n\n![](' || image_url || ')'
where image_url is not null;

alter table public.cards drop column if exists image_url;
