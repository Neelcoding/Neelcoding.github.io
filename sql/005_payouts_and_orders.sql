-- Seller payouts and order fulfilment.
--
-- Until this migration a completed purchase left no record at all: the webhook
-- flipped the listing to 'sold' and that was the whole story. Nobody could say
-- who bought it, where it should ship, or whether it ever did. This adds the
-- two halves that were missing: a Stripe Connect account per seller so money
-- can actually reach them, and an orders table so a sale is a thing with a
-- state rather than an event that already happened.
--
-- Run this in the Supabase Dashboard: SQL Editor -> New query -> paste -> Run.

-- ---------- Seller payout accounts ----------

-- Stripe is the source of truth for all three of these. We cache them so the
-- UI can tell a seller where they stand without an API round trip on render.
alter table public.profiles add column if not exists stripe_account_id text;
alter table public.profiles add column if not exists stripe_payouts_enabled boolean not null default false;
alter table public.profiles add column if not exists stripe_details_submitted boolean not null default false;

create index if not exists profiles_stripe_account_idx on public.profiles (stripe_account_id);

-- The existing profile UPDATE policy is row-scoped, not column-scoped, so
-- without this a seller could simply set their own stripe_payouts_enabled to
-- true. That would not let them steal anything (Stripe still refuses to pay an
-- unverified account) but it would put a Buy button on a listing that cannot
-- take money, which fails on the buyer's card instead of on the seller's form.
-- Only the service role, meaning our webhook, may move these columns.
create or replace function public.protect_stripe_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	if coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '') = 'service_role' then
		return new;
	end if;
	new.stripe_account_id := old.stripe_account_id;
	new.stripe_payouts_enabled := old.stripe_payouts_enabled;
	new.stripe_details_submitted := old.stripe_details_submitted;
	return new;
end;
$$;

drop trigger if exists protect_stripe_columns on public.profiles;
create trigger protect_stripe_columns
	before update on public.profiles
	for each row execute function public.protect_stripe_columns();

-- ---------- Orders ----------

create table if not exists public.orders (
	id uuid primary key default gen_random_uuid(),
	listing_id uuid not null references public.listings (id) on delete restrict,
	buyer_id uuid references public.profiles (id) on delete set null,
	seller_id uuid not null references public.profiles (id) on delete restrict,

	-- Stripe's session id is the idempotency key: the webhook can fire more
	-- than once for the same completed checkout, and a unique constraint is a
	-- cheaper defence than trying to make the handler stateful.
	stripe_session_id text unique not null,
	stripe_payment_intent text,

	-- Money is stored in cents as integers. Never floats, and never recomputed
	-- from the listing price, which the seller can edit after the sale.
	item_cents integer not null check (item_cents > 0),
	fee_cents integer not null check (fee_cents >= 0),
	total_cents integer not null check (total_cents > 0),

	buyer_email text,

	-- Flattened rather than jsonb: a postal address has a fixed shape, and the
	-- seller has to read every field off it to write a label.
	ship_name text,
	ship_line1 text,
	ship_line2 text,
	ship_city text,
	ship_state text,
	ship_postal_code text,
	ship_country text,

	status text not null default 'paid' check (status in ('paid', 'shipped', 'delivered', 'refund_requested', 'refunded', 'cancelled')),
	tracking_carrier text,
	tracking_number text,
	shipped_at timestamptz,

	refund_reason text,
	refund_requested_at timestamptz,

	created_at timestamptz not null default now()
);

create index if not exists orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index if not exists orders_seller_idx on public.orders (seller_id, created_at desc);
create index if not exists orders_listing_idx on public.orders (listing_id);

alter table public.orders enable row level security;

-- Only the two people involved in a sale can see it. There is deliberately no
-- INSERT or UPDATE policy: rows are written by the webhook under the service
-- role, and the two legitimate mutations go through the functions below.
create policy "Buyers and sellers can view their own orders"
	on public.orders for select
	using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- ---------- Order mutations ----------

-- These are security definer so the caller never gets a blanket UPDATE on
-- orders. A seller with direct update rights could rewrite item_cents or mark
-- an order refunded that was never refunded; here they can only do the one
-- thing the function is named after, and only on their own sale.
create or replace function public.mark_order_shipped(
	order_id uuid,
	carrier text,
	tracking text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
	result public.orders;
begin
	update public.orders
		set status = 'shipped',
			tracking_carrier = nullif(trim(carrier), ''),
			tracking_number = nullif(trim(tracking), ''),
			shipped_at = now()
		where id = order_id
			and seller_id = auth.uid()
			and status in ('paid', 'refund_requested')
		returning * into result;

	if result.id is null then
		raise exception 'Order not found, not yours, or already shipped';
	end if;
	return result;
end;
$$;

create or replace function public.request_order_refund(
	order_id uuid,
	reason text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
	result public.orders;
begin
	-- Buyer-initiated only, and only before the money is settled as delivered.
	-- This does not move money. It flags the order so the seller and the
	-- platform can see it and act in Stripe, which is honest about what the
	-- product can currently do rather than implying an automatic refund.
	update public.orders
		set status = 'refund_requested',
			refund_reason = nullif(trim(reason), ''),
			refund_requested_at = now()
		where id = order_id
			and buyer_id = auth.uid()
			and status in ('paid', 'shipped', 'delivered')
		returning * into result;

	if result.id is null then
		raise exception 'Order not found, not yours, or already resolved';
	end if;
	return result;
end;
$$;

create or replace function public.mark_order_delivered(order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
	result public.orders;
begin
	update public.orders
		set status = 'delivered'
		where id = order_id
			and buyer_id = auth.uid()
			and status = 'shipped'
		returning * into result;

	if result.id is null then
		raise exception 'Order not found, not yours, or not shipped yet';
	end if;
	return result;
end;
$$;

revoke all on function public.mark_order_shipped(uuid, text, text) from public;
revoke all on function public.request_order_refund(uuid, text) from public;
revoke all on function public.mark_order_delivered(uuid) from public;
grant execute on function public.mark_order_shipped(uuid, text, text) to authenticated;
grant execute on function public.request_order_refund(uuid, text) to authenticated;
grant execute on function public.mark_order_delivered(uuid) to authenticated;
