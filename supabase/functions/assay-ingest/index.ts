// Pulls real fragrance prices off eBay and writes them into the Assay tables.
//
// One API covers both anchors the model needs. eBay's Browse API can filter on
// condition, so a NEW search gives a street-price proxy and a USED search gives
// comparables. That matters because the alternative for street price is an
// affiliate feed, and those take weeks of approval that this does not.
//
// The important caveat, carried through into the data: Browse returns *active
// listings*, which are asking prices, not sales. Sellers list high and settle
// lower. Every comp written here is therefore marked kind='asking', and the
// model discounts them. Real sold prices need eBay's Marketplace Insights API,
// which is access-gated; when that lands it writes kind='sold' into this same
// table and nothing else has to change.
//
// Deploy:
//   export PATH="$HOME/.local/bin:$PATH"
//   export SUPABASE_ACCESS_TOKEN=$(security find-generic-password -s "Supabase CLI" -w)
//   supabase functions deploy assay-ingest --project-ref jtepvfnipteigidxtsfr --use-api
//
// Requires secrets: EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, SUPABASE_SERVICE_ROLE_KEY.

const EBAY_CLIENT_ID = Deno.env.get('EBAY_CLIENT_ID')!;
const EBAY_CLIENT_SECRET = Deno.env.get('EBAY_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// eBay's leaf category for fragrances. Scoping the search to it keeps bottle
// listings from competing with branded clothing and empty display bottles.
const CATEGORY_FRAGRANCES = '180345';
const EBAY_BASE = 'https://api.ebay.com';
const MARKETPLACE = 'EBAY_US';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/* ---------- eBay auth ---------- */

async function getEbayToken(): Promise<string> {
	const creds = btoa(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`);
	const res = await fetch(`${EBAY_BASE}/identity/v1/oauth2/token`, {
		method: 'POST',
		headers: {
			Authorization: `Basic ${creds}`,
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({
			grant_type: 'client_credentials',
			scope: 'https://api.ebay.com/oauth/api_scope',
		}),
	});
	if (!res.ok) throw new Error(`eBay auth failed: ${res.status} ${await res.text()}`);
	return (await res.json()).access_token;
}

/* ---------- Title parsing ----------
   Sellers describe bottles in free text, so size and fill have to be read out
   of the title. Anything that cannot be parsed confidently is skipped rather
   than guessed at: a wrong fill percentage corrupts the comp set far worse
   than a missing row does. */

/** Pulls a millilitre size out of a title, tolerating "3.3 oz" style listings. */
function parseSize(title: string, known: number[]): number | null {
	const ml = title.match(/(\d{2,3})\s?(?:ml|mL|ML)\b/);
	if (ml) {
		const v = Number(ml[1]);
		if (known.includes(v)) return v;
		// Round to a size this fragrance actually shipped in, within 5ml.
		const near = known.find((k) => Math.abs(k - v) <= 5);
		if (near) return near;
	}
	const oz = title.match(/(\d+(?:\.\d+)?)\s?(?:oz|OZ|fl\.?\s?oz)\b/);
	if (oz) {
		const v = Number(oz[1]) * 29.5735;
		const near = known.find((k) => Math.abs(k - v) <= 6);
		if (near) return near;
	}
	return null;
}

/** Reads a fill level, accepting "85% full", "approx 90%", "90 percent". */
function parseFill(title: string): number | null {
	const m = title.match(/(\d{1,3})\s?(?:%|percent)/i);
	if (!m) return null;
	const v = Number(m[1]);
	return v >= 5 && v <= 100 ? v : null;
}

/** Maps loose seller language onto the model's four condition grades. */
function parseCondition(title: string): string {
	const t = title.toLowerCase();
	if (/no\s?spray|doesn'?t spray|broken (?:atomi[sz]er|sprayer)|faulty/.test(t)) return 'faulty';
	if (/damaged|cracked|peeling|torn label|as[- ]is/.test(t)) return 'marked';
	if (/used|tested|partial|preowned|pre[- ]owned/.test(t)) return 'light';
	return 'mint';
}

function parseBox(title: string): string {
	const t = title.toLowerCase();
	if (/no box|without box|bottle only|boxless|tester/.test(t)) return 'no';
	if (/damaged box|worn box|box damaged/.test(t)) return 'damaged';
	if (/with box|in box|boxed|nib\b|sealed/.test(t)) return 'yes';
	return 'no';
}

/** Listings that are not a full retail bottle of the thing we asked for. */
function isJunk(title: string): boolean {
	const t = title.toLowerCase();
	return /decant|sample|travel spray|atomi[sz]er only|empty|refill|dupe|inspired by|clone|lot of|bundle|\bcard\b/.test(t);
}

/* ---------- eBay search ---------- */

type Item = { itemId: string; title: string; price: number };

async function search(token: string, q: string, used: boolean, limit = 60): Promise<Item[]> {
	const params = new URLSearchParams({
		q,
		category_ids: CATEGORY_FRAGRANCES,
		limit: String(limit),
		// 1000 is New. 3000/4000/5000/6000 are the used and open-box grades.
		filter: used
			? 'conditionIds:{3000|4000|5000|6000},buyingOptions:{FIXED_PRICE}'
			: 'conditionIds:{1000},buyingOptions:{FIXED_PRICE}',
	});
	const res = await fetch(`${EBAY_BASE}/buy/browse/v1/item_summary/search?${params}`, {
		headers: {
			Authorization: `Bearer ${token}`,
			'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE,
		},
	});
	if (!res.ok) {
		// A single bad query should not abandon the whole run.
		console.error(`search failed for "${q}" (used=${used}): ${res.status}`);
		return [];
	}
	const json = await res.json();
	return (json.itemSummaries || [])
		.map((i: Record<string, any>) => ({
			itemId: i.itemId as string,
			title: (i.title || '') as string,
			price: Number(i.price?.value ?? 0),
		}))
		.filter((i: Item) => i.itemId && i.price > 0);
}

/* ---------- Supabase writes ---------- */

async function upsert(table: string, rows: unknown[], conflict: string) {
	if (!rows.length) return 0;
	const res = await fetch(
		`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${conflict}`,
		{
			method: 'POST',
			headers: {
				apikey: SUPABASE_SERVICE_ROLE_KEY,
				Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
				'Content-Type': 'application/json',
				Prefer: 'resolution=merge-duplicates,return=minimal',
			},
			body: JSON.stringify(rows),
		},
	);
	if (!res.ok) {
		console.error(`upsert ${table} failed: ${res.status} ${await res.text()}`);
		return 0;
	}
	return rows.length;
}

async function loadFragrances(slug: string | null) {
	const q = slug ? `&slug=eq.${encodeURIComponent(slug)}` : '';
	const res = await fetch(
		`${SUPABASE_URL}/rest/v1/assay_fragrances?select=id,slug,name,house,sizes,search_query&active=is.true${q}`,
		{
			headers: {
				apikey: SUPABASE_SERVICE_ROLE_KEY,
				Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
			},
		},
	);
	if (!res.ok) throw new Error(`load fragrances failed: ${res.status}`);
	return await res.json();
}

/* ---------- Handler ---------- */

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	try {
		const url = new URL(req.url);
		const only = url.searchParams.get('slug');
		const token = await getEbayToken();
		const fragrances = await loadFragrances(only);

		const report: Record<string, { street: number; comps: number; skipped: number }> = {};

		for (const f of fragrances) {
			const query = f.search_query || `${f.house} ${f.name}`;
			const sizes: number[] = f.sizes || [];
			let street = 0;
			let comps = 0;
			let skipped = 0;

			// New and sealed: the street-price anchor.
			for (const item of await search(token, query, false)) {
				if (isJunk(item.title)) { skipped++; continue; }
				const size = parseSize(item.title, sizes);
				if (!size) { skipped++; continue; }
				street += await upsert('assay_street_prices', [{
					fragrance_id: f.id,
					size_ml: size,
					price: item.price,
					currency: 'USD',
					source: 'ebay_browse',
					external_id: item.itemId,
				}], 'source,external_id');
			}

			// Used: comparables. A used listing with no stated fill is still a
			// useful price point, so it is kept with fill_pct null and the model
			// simply cannot match it to a fill band.
			for (const item of await search(token, query, true)) {
				if (isJunk(item.title)) { skipped++; continue; }
				const size = parseSize(item.title, sizes);
				if (!size) { skipped++; continue; }
				comps += await upsert('assay_comps', [{
					fragrance_id: f.id,
					size_ml: size,
					fill_pct: parseFill(item.title),
					condition: parseCondition(item.title),
					box_included: parseBox(item.title),
					price: item.price,
					currency: 'USD',
					kind: 'asking',
					source: 'ebay_browse',
					external_id: item.itemId,
				}], 'source,external_id');
			}

			report[f.slug] = { street, comps, skipped };
		}

		return new Response(JSON.stringify({ ok: true, fragrances: fragrances.length, report }, null, 2), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	} catch (err) {
		console.error(err);
		return new Response(JSON.stringify({ ok: false, error: String(err) }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
});
