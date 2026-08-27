-- Vial marketplace: profile photos.
-- Run after 003_message_read_state.sql.

alter table public.profiles
	add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly readable"
	on storage.objects for select
	using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
	on storage.objects for insert
	with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update their own avatar"
	on storage.objects for update
	using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their own avatar"
	on storage.objects for delete
	using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
