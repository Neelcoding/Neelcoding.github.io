// Seller payout accounts, via Stripe Connect.
//
// Express is the right account type for this marketplace: Stripe hosts the
// onboarding, collects identity, bank details and tax forms, and takes on the
// verification. None of that data touches this project, which is the point.
//
// Three actions, all requiring the caller's own access token:
//   start     -> create (or reuse) the caller's Express account, return a
//                hosted onboarding link to send them to
//   status    -> re-read the account from Stripe and cache the flags
//   dashboard -> a one-time login link to the seller's Express dashboard,
//                where they can see payouts and change their bank account
//
// Deploy via the Supabase Dashboard: Edge Functions -> Deploy a new function -> "Via Editor".
// Requires secrets: STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY.
//
// Before this works at all, the platform account must enable Connect and
// accept the Connect service agreement:
//   Stripe Dashboard -> Connect -> Get started -> pick "Platform or marketplace".
// That is a one-time action only the account owner can take.
//
// ---------- Accounts v2 ----------
// New accounts are created through v2 (POST /v2/core/accounts). Stripe stopped
// recommending v1 for new integrations and only accepts it while the Accounts
// v1 support toggle is switched on in the dashboard, which is a compatibility
// door rather than a permanent one.
//
// v1 remains as a fallback rather than being deleted. Two reasons: sellers who
// onboarded before this change hold v1 accounts and must keep working, and if
// v2 rejects a request for a reason that only shows up in production, the
// fallback is the difference between a degraded path and no payouts at all.
//
// The v2 shape below was verified against the live API rather than taken from
// prose: the recipient capability is stripe_balance.stripe_transfers, and an
// express dashboard requires both collectors to be "application", which is
// correct here because the platform keeps the processing fee and eats
// chargebacks.

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
// Pinned rather than floating: v2 requires an explicit version header, and a
// silent bump could change the account shape underneath a working flow.
const V2_API_VERSION = '2026-08-26.dahlia';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Creates a connected account for a seller, preferring Accounts v2.
 *
 * Sellers only ever receive money from the platform, so they are a *recipient*
 * rather than a merchant: they take no payments of their own, and asking for
 * merchant capabilities would drag them through verification they do not need.
 */
async function createAccount(user: { id: string; email?: string }): Promise<{ id?: string; error?: string }> {
	const v2 = await fetch('https://api.stripe.com/v2/core/accounts', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
			'Stripe-Version': V2_API_VERSION,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			contact_email: user.email ?? '',
			identity: { country: 'us', entity_type: 'individual' },
			configuration: {
				recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
			},
			// Express gives the seller a hosted dashboard to see payouts and
			// change their bank details without any of it passing through here.
			dashboard: 'express',
			// The platform is merchant of record on a destination charge, so it
			// collects the fee and carries the losses. Express requires both to
			// be "application" anyway.
			defaults: { responsibilities: { fees_collector: 'application', losses_collector: 'application' } },
			metadata: { profile_id: user.id },
		}),
	});
	const body = await v2.json().catch(() => ({}));
	if (v2.ok && body.id) return { id: body.id };

	console.error('accounts v2 create failed, falling back to v1:', v2.status, JSON.stringify(body?.error ?? body));

	const legacy = await stripe('accounts', 'POST', {
		type: 'express',
		email: user.email ?? '',
		'capabilities[transfers][requested]': 'true',
		'business_profile[product_description]': 'Pre-owned and new fragrance sold on Vial',
		'metadata[profile_id]': user.id,
	});
	if (legacy.error) return { error: legacy.error.message };
	return { id: legacy.id };
}

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

	try {
		// Identify the caller from their own JWT. Everything below acts on this
		// user and only this user, so nobody can start onboarding, read status,
		// or mint a dashboard link for somebody else's payout account.
		const authHeader = req.headers.get('Authorization') || '';
		const user = await getUser(authHeader);
		if (!user) return json({ error: 'You need to be signed in.' }, 401);

		const { action = 'start', origin } = await req.json().catch(() => ({}));

		const profile = await getProfile(user.id);
		if (!profile) return json({ error: 'Profile not found.' }, 404);

		if (action === 'status') {
			if (!profile.stripe_account_id) {
				return json({ connected: false, payoutsEnabled: false, detailsSubmitted: false });
			}
			const account = await stripe(`accounts/${profile.stripe_account_id}`, 'GET');
			if (account.error) return json({ error: account.error.message }, 502);
			await cacheAccountFlags(user.id, account);
			return json({
				connected: true,
				payoutsEnabled: !!account.payouts_enabled,
				detailsSubmitted: !!account.details_submitted,
				requirements: account.requirements?.currently_due ?? [],
			});
		}

		if (action === 'dashboard') {
			if (!profile.stripe_account_id) return json({ error: 'No payout account yet.' }, 409);
			const link = await stripe(`accounts/${profile.stripe_account_id}/login_links`, 'POST');
			if (link.error) return json({ error: link.error.message }, 502);
			return json({ url: link.url });
		}

		// action === 'start'
		if (!origin) return json({ error: 'origin is required' }, 400);

		let accountId = profile.stripe_account_id;

		if (!accountId) {
			const created = await createAccount(user);
			if (created.error) return json({ error: created.error }, 502);
			accountId = created.id;
			await patchProfile(user.id, { stripe_account_id: accountId });
		}

		// Account links are single-use and short-lived, so this is generated
		// fresh every time rather than stored. refresh_url is where Stripe sends
		// someone whose link expired mid-flow; pointing it back at the account
		// page means they land somewhere that can hand them a new one.
		const link = await stripe('account_links', 'POST', {
			account: accountId!,
			refresh_url: `${origin}/account.html?payouts=refresh`,
			return_url: `${origin}/account.html?payouts=done`,
			type: 'account_onboarding',
		});
		if (link.error) return json({ error: link.error.message }, 502);

		return json({ url: link.url });
	} catch (err) {
		return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
	}
});

async function getUser(authHeader: string) {
	if (!authHeader.startsWith('Bearer ')) return null;
	const token = authHeader.slice(7);
	// The anon key is not a user token; reject it early so an unauthenticated
	// call can't fall through to a confusing Stripe error.
	if (token === SUPABASE_ANON_KEY) return null;
	const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
		headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
	});
	if (!res.ok) return null;
	const user = await res.json();
	return user?.id ? user : null;
}

async function getProfile(id: string) {
	const res = await fetch(
		`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=id,stripe_account_id`,
		{ headers: serviceHeaders() },
	);
	const rows = await res.json();
	return rows?.[0] ?? null;
}

async function patchProfile(id: string, updates: Record<string, unknown>) {
	await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`, {
		method: 'PATCH',
		headers: { ...serviceHeaders(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
		body: JSON.stringify(updates),
	});
}

async function cacheAccountFlags(id: string, account: Record<string, unknown>) {
	await patchProfile(id, {
		stripe_payouts_enabled: !!account.payouts_enabled,
		stripe_details_submitted: !!account.details_submitted,
	});
}

function serviceHeaders() {
	return {
		apikey: SUPABASE_SERVICE_ROLE_KEY,
		Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
	};
}

async function stripe(path: string, method: 'GET' | 'POST', params?: Record<string, string>) {
	const res = await fetch(`https://api.stripe.com/v1/${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: params ? new URLSearchParams(params) : undefined,
	});
	return await res.json();
}

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...corsHeaders, 'Content-Type': 'application/json' },
	});
}
