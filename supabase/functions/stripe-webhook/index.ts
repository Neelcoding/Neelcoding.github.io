// Verifies Stripe webhook events and marks a listing as sold once payment completes.
// Deploy via the Supabase Dashboard: Edge Functions -> Deploy a new function -> "Via Editor".
// Requires Supabase secrets: STRIPE_WEBHOOK_SECRET.
// After deploying, copy this function's URL into Stripe Dashboard -> Developers -> Webhooks
// -> Add endpoint, select the "checkout.session.completed" event, and copy the signing
// secret it gives you into the STRIPE_WEBHOOK_SECRET secret.

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
	const signatureHeader = req.headers.get('stripe-signature');
	const payload = await req.text();

	if (!signatureHeader || !(await isValidStripeSignature(payload, signatureHeader, STRIPE_WEBHOOK_SECRET))) {
		return new Response('Invalid signature', { status: 400 });
	}

	const event = JSON.parse(payload);

	if (event.type === 'checkout.session.completed') {
		const listingId = event.data?.object?.metadata?.listing_id;
		if (listingId) {
			await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${encodeURIComponent(listingId)}`, {
				method: 'PATCH',
				headers: {
					apikey: SUPABASE_SERVICE_ROLE_KEY,
					Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
					'Content-Type': 'application/json',
					Prefer: 'return=minimal',
				},
				body: JSON.stringify({ status: 'sold' }),
			});
		}
	}

	return new Response(JSON.stringify({ received: true }), {
		headers: { 'Content-Type': 'application/json' },
	});
});

async function isValidStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
	const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
	const timestamp = parts.t;
	const signature = parts.v1;
	if (!timestamp || !signature) return false;

	// Reject events older than 5 minutes to guard against replay attacks.
	if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
	const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');

	if (expected.length !== signature.length) return false;
	let diff = 0;
	for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
	return diff === 0;
}
