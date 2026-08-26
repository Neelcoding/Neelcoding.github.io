// Creates a Stripe Checkout session for a single listing.
//
// This is a Connect *destination charge*: the buyer pays the platform, Stripe
// transfers the listing price to the seller's connected account, and the 5%
// processing fee stays behind as an application fee. The seller is paid by
// Stripe on their normal payout schedule; no money is ever moved by hand.
//
// One economic note worth knowing: on a destination charge the platform is the
// merchant of record, so Stripe's own processing fee (roughly 2.9% + 30c) comes
// out of the platform's side, not the seller's. On a $100 bottle that means
// $6.00 collected, about $3.37 paid to Stripe, so the real margin is nearer 2.6%
// than 6%.
//
// The fixed 30c component is what hurts: at 6% the platform only breaks even
// around a $10 listing, and loses money below it. A minimum fee rather than a
// flat percentage is the fix if cheap bottles turn out to be common.
//
// Deploy via the Supabase Dashboard: Edge Functions -> Deploy a new function -> "Via Editor".
// Requires secrets: STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY.

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Keep in sync with PROCESSING_FEE_RATE in marketplace/js/listing.js, which
// quotes this number to the buyer before checkout. If the two drift, the buyer
// is shown a total that is not what they are charged.
const PROCESSING_FEE_RATE = 0.06;

// Fragrance is a flammable liquid, so it ships under ground-only rules that
// carriers apply domestically and largely refuse across borders. Collecting an
// address we cannot legally ship to would be worse than not offering it.
const SHIPPING_COUNTRIES = ['US'];

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	try {
		const { listingId, origin } = await req.json();
		if (!listingId || !origin) {
			return json({ error: 'listingId and origin are required' }, 400);
		}

		// The buyer is optional here only because checkout still has to work if
		// the session token is missing; when we do have one, the order can be
		// tied to a real account instead of just an email.
		const buyer = await getUser(req.headers.get('Authorization') || '');

		const listingRes = await fetch(
			`${SUPABASE_URL}/rest/v1/listings?id=eq.${encodeURIComponent(listingId)}` +
				`&select=id,brand,name,price,status,seller_id,profiles(id,stripe_account_id,stripe_payouts_enabled)`,
			{ headers: serviceHeaders() },
		);
		const listings = await listingRes.json();
		const listing = listings?.[0];
		if (!listing) return json({ error: 'Listing not found' }, 404);
		if (listing.status === 'sold') return json({ error: 'This listing is already sold' }, 409);

		if (buyer && buyer.id === listing.seller_id) {
			return json({ error: "This is your own listing, so you can't buy it." }, 409);
		}

		// Refuse before charging rather than after. Taking a buyer's money for a
		// seller who has no way to receive it is the one failure mode this whole
		// migration exists to make impossible.
		const seller = listing.profiles;
		if (!seller?.stripe_account_id || !seller.stripe_payouts_enabled) {
			return json(
				{ error: "This seller hasn't finished setting up payouts yet, so the bottle can't be bought right now. Message them and they'll get a prompt to finish." },
				409,
			);
		}

		const priceCents = Math.round(Number(listing.price) * 100);
		const feeCents = Math.round(priceCents * PROCESSING_FEE_RATE);
		const totalCents = priceCents + feeCents;

		const body = new URLSearchParams({
			mode: 'payment',
			success_url: `${origin}/orders.html?purchase=success`,
			cancel_url: `${origin}/listing.html?id=${listing.id}&purchase=cancelled`,
			'line_items[0][quantity]': '1',
			'line_items[0][price_data][currency]': 'usd',
			'line_items[0][price_data][unit_amount]': String(priceCents),
			'line_items[0][price_data][product_data][name]': `${listing.brand} ${listing.name}`,
			'line_items[1][quantity]': '1',
			'line_items[1][price_data][currency]': 'usd',
			'line_items[1][price_data][unit_amount]': String(feeCents),
			'line_items[1][price_data][product_data][name]': 'Processing fee (5%)',

			// The split. transfer_data sends the item price on to the seller;
			// application_fee_amount is what stays with the platform.
			'payment_intent_data[transfer_data][destination]': seller.stripe_account_id,
			'payment_intent_data[application_fee_amount]': String(feeCents),
			'payment_intent_data[description]': `Vial: ${listing.brand} ${listing.name}`,

			'metadata[listing_id]': listing.id,
			'metadata[seller_id]': listing.seller_id,
			'metadata[item_cents]': String(priceCents),
			'metadata[processing_fee_cents]': String(feeCents),
			'metadata[total_cents]': String(totalCents),
		});

		SHIPPING_COUNTRIES.forEach((code, i) => {
			body.set(`shipping_address_collection[allowed_countries][${i}]`, code);
		});

		if (buyer) {
			body.set('metadata[buyer_id]', buyer.id);
			if (buyer.email) body.set('customer_email', buyer.email);
		}

		const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body,
		});

		const session = await stripeRes.json();
		if (!stripeRes.ok) return json({ error: session.error?.message || 'Stripe error' }, 500);

		return json({ url: session.url });
	} catch (err) {
		return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
	}
});

async function getUser(authHeader: string) {
	if (!authHeader.startsWith('Bearer ')) return null;
	const token = authHeader.slice(7);
	if (token === SUPABASE_ANON_KEY) return null;
	const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
		headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
	});
	if (!res.ok) return null;
	const user = await res.json();
	return user?.id ? user : null;
}

function serviceHeaders() {
	return {
		apikey: SUPABASE_SERVICE_ROLE_KEY,
		Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
	};
}

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...corsHeaders, 'Content-Type': 'application/json' },
	});
}
