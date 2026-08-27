-- Vial marketplace schema.
-- Run this once in your Supabase project's SQL editor (Dashboard -> SQL Editor -> New query).
-- After running it, copy your project's URL + anon key into marketplace/js/supabase-client.js.

-- ---------- Profiles ----------
create table if not exists public.profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	username text unique not null,
	display_name text,
	location text,
	bio text,
	created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
	on public.profiles for select
	using (true);

create policy "Users can update their own profile"
	on public.profiles for update
	using (auth.uid() = id);

-- Auto-create a profile row whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
	insert into public.profiles (id, username, display_name)
	values (
		new.id,
		coalesce(split_part(new.email, '@', 1), 'user') || '_' || substr(new.id::text, 1, 4),
		coalesce(split_part(new.email, '@', 1), 'New user')
	);
	return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
	after insert on auth.users
	for each row execute procedure public.handle_new_user();

-- ---------- Listings ----------
create table if not exists public.listings (
	id uuid primary key default gen_random_uuid(),
	seller_id uuid not null references public.profiles (id) on delete cascade,
	brand text not null,
	name text not null,
	gender text check (gender in ('men', 'women', 'unisex')) default 'unisex',
	scent_family text[] default '{}',
	size_ml integer not null check (size_ml > 0),
	fill_percentage integer not null check (fill_percentage between 1 and 100),
	condition text not null check (condition in ('new', 'like_new', 'gently_used', 'well_used')),
	box_included text not null default 'no' check (box_included in ('yes', 'no', 'damaged')),
	batch_code text,
	purchase_year integer,
	price numeric(10, 2) not null check (price > 0),
	description text,
	images text[] default '{}',
	status text not null default 'available' check (status in ('available', 'sold', 'reserved')),
	created_at timestamptz not null default now()
);

create index if not exists listings_status_idx on public.listings (status);
create index if not exists listings_seller_idx on public.listings (seller_id);

alter table public.listings enable row level security;

create policy "Listings are viewable by everyone"
	on public.listings for select
	using (true);

create policy "Sellers can insert their own listings"
	on public.listings for insert
	with check (auth.uid() = seller_id);

create policy "Sellers can update their own listings"
	on public.listings for update
	using (auth.uid() = seller_id);

create policy "Sellers can delete their own listings"
	on public.listings for delete
	using (auth.uid() = seller_id);

-- ---------- Storage: listing photos ----------
insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do nothing;

create policy "Listing images are publicly readable"
	on storage.objects for select
	using (bucket_id = 'listing-images');

create policy "Authenticated users can upload listing images"
	on storage.objects for insert
	with check (bucket_id = 'listing-images' and auth.role() = 'authenticated');

create policy "Owners can update their own listing images"
	on storage.objects for update
	using (bucket_id = 'listing-images' and owner = auth.uid());

create policy "Owners can delete their own listing images"
	on storage.objects for delete
	using (bucket_id = 'listing-images' and owner = auth.uid());

-- ---------- Next steps once this is live ----------
-- 1. Project Settings -> API: copy the Project URL and anon public key.
-- 2. Paste them into marketplace/js/supabase-client.js (SUPABASE_URL / SUPABASE_ANON_KEY).
-- 3. Authentication -> Providers: email/password is enabled by default; turn off
--    "Confirm email" while prototyping if you want signups to work immediately.
-- 4. Reload the site: the demo-mode banner disappears once real credentials are set,
--    and all reads/writes in marketplace/js/db.js switch from mock data to Supabase.
