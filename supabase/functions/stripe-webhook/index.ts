// Stripe's side of the story, written back into the database.
//
// Handles three things:
//   checkout.session.completed -> record the order (buyer, seller, amounts,
//                                 shipping address) and mark the listing sold
//   account.updated            -> cache a seller's payout status so the UI can
//                                 tell them whether onboarding is finished
//   charge.refunded            -> close the loop when money goes back
//
// Deploy via the Supabase Dashboard: Edge Functions -> Deploy a new function -> "Via Editor".
// Requires secrets: STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY.
// Optionally STRIPE_CONNECT_WEBHOOK_SECRET, if account.updated is delivered
// through a separate Connect endpoint with its own signing secret. Both are
// tried, so a single endpoint carrying every event works too.
//
// In Stripe Dashboard -> Developers -> Webhooks, this endpoint should be
// subscribed to: checkout.session.completed, account.updated, charge.refunded.

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const STRIPE_CONNECT_WEBHOOK_SECRET = Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
	const signatureHeader = req.headers.get('stripe-signature');
	const payload = await req.text();

	if (!signatureHeader || !(await isValidStripeSignature(payload, signatureHeader))) {
		return new Response('Invalid signature', { status: 400 });
	}

	const event = JSON.parse(payload);
	const object = event.data?.object ?? {};

	try {
		if (event.type === 'checkout.session.completed') {
			await handleCheckoutCompleted(object);
		} else if (event.type === 'account.updated') {
			await handleAccountUpdated(object);
		} else if (event.type === 'charge.refunded') {
			await handleChargeRefunded(object);
		}
	} catch (err) {
		// Returning 500 asks Stripe to retry, which is what we want for a
		// transient database failure. Returning 200 on an error would silently
		// lose the order.
		console.error(event.type, err);
		return new Response('Handler error', { status: 500 });
	}

	return new Response(JSON.stringify({ received: true }), {
		headers: { 'Content-Type': 'application/json' },
	});
});

async function handleCheckoutCompleted(session: Record<string, any>) {
	const meta = session.metadata ?? {};
	if (!meta.listing_id || !meta.seller_id) return;

	// Stripe moved shipping onto collected_information in later API versions;
	// read whichever one this account's version produces.
	const shipping = session.collected_information?.shipping_details ?? session.shipping_details ?? {};
	const address = shipping.address ?? {};

	const itemCents = Number(meta.item_cents) || 0;
	const feeCents = Number(meta.processing_fee_cents) || 0;
	const totalCents = Number(meta.total_cents) || session.amount_total || itemCents + feeCents;

	// on_conflict + ignore-duplicates makes a redelivered event a no-op rather
	// than a second order for the same payment.
	const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?on_conflict=stripe_session_id`, {
		method: 'POST',
		headers: {
			...serviceHeaders(),
			'Content-Type': 'application/json',
			Prefer: 'resolution=ignore-duplicates,return=minimal',
		},
		body: JSON.stringify({
			listing_id: meta.listing_id,
			buyer_id: meta.buyer_id || null,
			seller_id: meta.seller_id,
			stripe_session_id: session.id,
			stripe_payment_intent: session.payment_intent ?? null,
			item_cents: itemCents,
			fee_cents: feeCents,
			total_cents: totalCents,
			buyer_email: session.customer_details?.email ?? null,
			ship_name: shipping.name ?? session.customer_details?.name ?? null,
			ship_line1: address.line1 ?? null,
			ship_line2: address.line2 ?? null,
			ship_city: address.city ?? null,
			ship_state: address.state ?? null,
			ship_postal_code: address.postal_code ?? null,
			ship_country: address.country ?? null,
			status: 'paid',
		}),
	});
	if (!res.ok) throw new Error(`order insert failed: ${res.status} ${await res.text()}`);

	await patch(`listings?id=eq.${encodeURIComponent(meta.listing_id)}`, { status: 'sold' });
}

async function handleAccountUpdated(account: Record<string, any>) {
	if (!account.id) return;
	await patch(`profiles?stripe_account_id=eq.${encodeURIComponent(account.id)}`, {
		stripe_payouts_enabled: !!account.payouts_enabled,
		stripe_details_submitted: !!account.details_submitted,
	});
}

async function handleChargeRefunded(charge: Record<string, any>) {
	const pi = charge.payment_intent;
	if (!pi) return;
	// Partial refunds leave the order in place and only fully refunded charges
	// close it out, so a $5 goodwill credit doesn't read as "money returned".
	if (charge.amount_refunded < charge.amount) return;
	await patch(`orders?stripe_payment_intent=eq.${encodeURIComponent(pi)}`, { status: 'refunded' });
}

async function patch(path: string, body: Record<string, unknown>) {
	const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
		method: 'PATCH',
		headers: { ...serviceHeaders(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
		body: JSON.stringify(body),
	});
	if (!res.ok) throw new Error(`patch ${path} failed: ${res.status} ${await res.text()}`);
}

function serviceHeaders() {
	return {
		apikey: SUPABASE_SERVICE_ROLE_KEY,
		Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
	};
}

async function isValidStripeSignature(payload: string, header: string): Promise<boolean> {
	const secrets = [STRIPE_WEBHOOK_SECRET, STRIPE_CONNECT_WEBHOOK_SECRET].filter(Boolean);
	for (const secret of secrets) {
		if (await matchesSecret(payload, header, secret)) return true;
	}
	return false;
}

async function matchesSecret(payload: string, header: string, secret: string): Promise<boolean> {
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
