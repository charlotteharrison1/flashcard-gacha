-- Replace the separate front/back image fields with one explanatory picture per card.
-- Safe to run whether or not 0007_media.sql has already run.

alter table public.cards add column if not exists image_url text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cards' and column_name = 'front_image_url'
  ) then
    update public.cards set image_url = coalesce(image_url, front_image_url, back_image_url);
    alter table public.cards drop column front_image_url;
    alter table public.cards drop column back_image_url;
  end if;
end $$;
