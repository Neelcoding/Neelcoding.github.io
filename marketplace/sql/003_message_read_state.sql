-- Vial marketplace: read-state tracking for conversations, so the header
-- can show an unread-messages badge. Run after 002_messaging_offers_auctions.sql.

alter table public.conversations
	add column if not exists buyer_last_read_at timestamptz not null default now(),
	add column if not exists seller_last_read_at timestamptz not null default now();

create policy "Participants can update their own read state"
	on public.conversations for update
	using (auth.uid() = buyer_id or auth.uid() = seller_id)
	with check (auth.uid() = buyer_id or auth.uid() = seller_id);
