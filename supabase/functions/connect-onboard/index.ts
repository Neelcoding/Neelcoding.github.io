// Seller payout accounts, via Stripe Connect Express.
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

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
			const created = await stripe('accounts', 'POST', {
				type: 'express',
				email: user.email ?? '',
				'capabilities[transfers][requested]': 'true',
				'business_profile[product_description]': 'Pre-owned and new fragrance sold on Vial',
				'metadata[profile_id]': user.id,
			});
			if (created.error) return json({ error: created.error.message }, 502);
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
