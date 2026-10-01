-- Deck colour/icon overrides, card images, and the storage bucket that holds them.
-- Run once in Supabase Dashboard > SQL Editor, after 0006_variable_earnings.sql.

alter table public.decks add column color smallint check (color between 0 and 5);
alter table public.decks add column icon_url text;

alter table public.cards add column front_image_url text;
alter table public.cards add column back_image_url text;

-- Public bucket: viewing an image needs no auth (it's just artwork), but writing does.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads', 'uploads', true, 5242880, array['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
on conflict (id) do nothing;

-- storage.objects already has row-level security on by default. Every upload is saved under
-- <user id>/..., so these policies check that prefix; reads don't need a policy (bucket is public).
create policy "uploads: owner can insert" on storage.objects
  for insert with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "uploads: owner can update" on storage.objects
  for update using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "uploads: owner can delete" on storage.objects
  for delete using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
