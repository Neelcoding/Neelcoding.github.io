// Creates a Stripe Checkout session for a single listing and returns its URL.
// Deploy via the Supabase Dashboard: Edge Functions -> Deploy a new function -> "Via Editor".
// Requires a Supabase secret named STRIPE_SECRET_KEY (Edge Functions -> Secrets).

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

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

		const listingRes = await fetch(
			`${SUPABASE_URL}/rest/v1/listings?id=eq.${encodeURIComponent(listingId)}&select=id,brand,name,price,status`,
			{ headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } },
		);
		const listings = await listingRes.json();
		const listing = listings?.[0];
		if (!listing) return json({ error: 'Listing not found' }, 404);
		if (listing.status === 'sold') return json({ error: 'This listing is already sold' }, 409);

		const body = new URLSearchParams({
			mode: 'payment',
			success_url: `${origin}/listing.html?id=${listing.id}&purchase=success`,
			cancel_url: `${origin}/listing.html?id=${listing.id}&purchase=cancelled`,
			'line_items[0][quantity]': '1',
			'line_items[0][price_data][currency]': 'usd',
			'line_items[0][price_data][unit_amount]': String(Math.round(Number(listing.price) * 100)),
			'line_items[0][price_data][product_data][name]': `${listing.brand} ${listing.name}`,
			'metadata[listing_id]': listing.id,
		});

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

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...corsHeaders, 'Content-Type': 'application/json' },
	});
}
