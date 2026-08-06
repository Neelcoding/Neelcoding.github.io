-- Vial marketplace: messaging, offers, and auctions.
-- Run this once in the SQL Editor, after schema.sql has already been run.

-- ---------- Auctions (extend listings) ----------
alter table public.listings
	add column if not exists is_auction boolean not null default false,
	add column if not exists auction_ends_at timestamptz;

-- ---------- Bids ----------
create table if not exists public.bids (
	id uuid primary key default gen_random_uuid(),
	listing_id uuid not null references public.listings (id) on delete cascade,
	bidder_id uuid not null references public.profiles (id) on delete cascade,
	amount numeric(10, 2) not null check (amount > 0),
	created_at timestamptz not null default now()
);

create index if not exists bids_listing_idx on public.bids (listing_id);

alter table public.bids enable row level security;

create policy "Bids are viewable by everyone"
	on public.bids for select
	using (true);

create policy "Signed-in users can place bids"
	on public.bids for insert
	with check (auth.uid() = bidder_id);

create or replace function public.check_bid_valid()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
	l record;
	current_high numeric;
begin
	select * into l from public.listings where id = new.listing_id;
	if l is null then
		raise exception 'Listing not found';
	end if;
	if not l.is_auction then
		raise exception 'This listing is not an auction';
	end if;
	if l.auction_ends_at is null or now() > l.auction_ends_at then
		raise exception 'This auction has ended';
	end if;
	if l.status = 'sold' then
		raise exception 'This listing is already sold';
	end if;
	select max(amount) into current_high from public.bids where listing_id = new.listing_id;
	if current_high is null then
		if new.amount <= l.price then
			raise exception 'Your bid must be higher than the starting price';
		end if;
	else
		if new.amount <= current_high then
			raise exception 'Your bid must be higher than the current highest bid';
		end if;
	end if;
	return new;
end;
$$;

drop trigger if exists on_bid_insert on public.bids;
create trigger on_bid_insert
	before insert on public.bids
	for each row execute procedure public.check_bid_valid();

-- ---------- Offers ----------
create table if not exists public.offers (
	id uuid primary key default gen_random_uuid(),
	listing_id uuid not null references public.listings (id) on delete cascade,
	buyer_id uuid not null references public.profiles (id) on delete cascade,
	seller_id uuid not null references public.profiles (id) on delete cascade,
	amount numeric(10, 2) not null check (amount > 0),
	message text,
	status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
	created_at timestamptz not null default now()
);

create index if not exists offers_seller_idx on public.offers (seller_id);
create index if not exists offers_listing_idx on public.offers (listing_id);

alter table public.offers enable row level security;

create policy "Buyers and sellers can view their own offers"
	on public.offers for select
	using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "Signed-in users can make offers"
	on public.offers for insert
	with check (auth.uid() = buyer_id);

create policy "Sellers can update offers on their listings"
	on public.offers for update
	using (auth.uid() = seller_id);

-- Offers are non-binding, so no payment info is ever collected - just enforce
-- that an offer can't meet or exceed the asking price.
create or replace function public.check_offer_amount()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
	listing_price numeric;
begin
	select price into listing_price from public.listings where id = new.listing_id;
	if listing_price is null then
		raise exception 'Listing not found';
	end if;
	if new.amount >= listing_price then
		raise exception 'Offer must be lower than the asking price';
	end if;
	return new;
end;
$$;

drop trigger if exists on_offer_insert on public.offers;
create trigger on_offer_insert
	before insert on public.offers
	for each row execute procedure public.check_offer_amount();

-- ---------- Conversations & messages ----------
create table if not exists public.conversations (
	id uuid primary key default gen_random_uuid(),
	listing_id uuid references public.listings (id) on delete set null,
	buyer_id uuid not null references public.profiles (id) on delete cascade,
	seller_id uuid not null references public.profiles (id) on delete cascade,
	created_at timestamptz not null default now(),
	unique (buyer_id, seller_id, listing_id)
);

alter table public.conversations enable row level security;

create policy "Participants can view their conversations"
	on public.conversations for select
	using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "Buyers can start conversations"
	on public.conversations for insert
	with check (auth.uid() = buyer_id);

create table if not exists public.messages (
	id uuid primary key default gen_random_uuid(),
	conversation_id uuid not null references public.conversations (id) on delete cascade,
	sender_id uuid not null references public.profiles (id) on delete cascade,
	body text not null,
	created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);

alter table public.messages enable row level security;

create policy "Participants can view messages in their conversations"
	on public.messages for select
	using (exists (
		select 1 from public.conversations c
		where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
	));

create policy "Participants can send messages in their conversations"
	on public.messages for insert
	with check (
		auth.uid() = sender_id
		and exists (
			select 1 from public.conversations c
			where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
		)
	);
