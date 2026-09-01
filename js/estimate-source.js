// Resolves the estimator's data: Supabase when it has real observations,
// the bundled mock set when it does not.
//
// The fallback is per fragrance, not global. Coverage arrives unevenly, so
// Aventus can be running on live eBay data while Layton is still on mock, and
// nothing about the page changes when a fragrance crosses over. There is no
// cutover event to manage.
//
// Every failure path here is silent and falls back. This module ships to a live
// page, and the tables may not exist yet: a missing relation, an expired key or
// an offline visitor must degrade to mock data rather than break the estimator.

import { getSupabase, isSupabaseConfigured } from './supabase-client.js';
import { setLive, CATALOGUE } from './estimate-data.js';

/** Observations older than this stop counting as current market. */
const FRESH_DAYS = 90;

/** Asking prices skew high. Until sold data exists, discount them. */
const ASKING_HAIRCUT = 0.88;

const CONDITION_LABEL = {
	mint: 'Mint',
	light: 'Light wear',
	marked: 'Marked',
	faulty: 'Faulty atomiser',
};

const hydrated = new Set();

function median(nums) {
	if (!nums.length) return null;
	const s = [...nums].sort((a, b) => a - b);
	const mid = Math.floor(s.length / 2);
	return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function shortDate(iso) {
	const d = new Date(iso);
	return `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('en-US', { month: 'short' })}`;
}

/**
 * Pulls real observations for one fragrance and registers them as the live set.
 * Resolves to true only if enough real data arrived to be worth using.
 */
export async function hydrate(slug) {
	if (!isSupabaseConfigured || hydrated.has(slug)) return false;
	hydrated.add(slug);

	try {
		const sb = await getSupabase();
		if (!sb) return false;

		const { data: frag, error: fe } = await sb
			.from('assay_fragrances')
			.select('id, slug')
			.eq('slug', slug)
			.maybeSingle();
		if (fe || !frag) return false;

		const since = new Date(Date.now() - FRESH_DAYS * 864e5).toISOString();

		const [{ data: comps }, { data: street }] = await Promise.all([
			sb.from('assay_comps')
				.select('size_ml, fill_pct, condition, price, kind, observed_at')
				.eq('fragrance_id', frag.id)
				.gte('observed_at', since)
				.order('observed_at', { ascending: false })
				.limit(400),
			sb.from('assay_street_prices')
				.select('size_ml, price, observed_at, source')
				.eq('fragrance_id', frag.id)
				.gte('observed_at', since)
				.limit(400),
		]);

		if (!comps?.length && !street?.length) return false;


		// One street price per size, taken as the median of what is listed. A
		// median rather than the minimum, because the cheapest listing on eBay
		// is usually the one that is wrong about something.
		// Seeded anchors and observed ones are kept apart. An observation for a
		// size always wins over an estimate for the same size, and the estimated
		// flag rides along so the model can refuse to sound confident about a
		// number nobody has actually seen paid.
		const observed = {};
		const estimated = {};
		for (const row of street || []) {
			const bucket = row.source === 'estimate' ? estimated : observed;
			(bucket[row.size_ml] ||= []).push(Number(row.price));
		}
		const streetPrices = {};
		const streetEstimated = {};
		for (const size of new Set([...Object.keys(observed), ...Object.keys(estimated)])) {
			const real = observed[size];
			streetPrices[Number(size)] = Math.round(median(real?.length ? real : estimated[size]));
			streetEstimated[Number(size)] = !real?.length;
		}

		// Comps are reshaped into what the UI already renders, so the display
		// layer never has to know which source a row came from.
		const shaped = (comps || []).map((c) => ({
			size: c.size_ml,
			fill: c.fill_pct,
			condition: CONDITION_LABEL[c.condition] || 'Used',
			price: Math.round(Number(c.price) * (c.kind === 'asking' ? ASKING_HAIRCUT : 1)),
			date: shortDate(c.observed_at),
			kind: c.kind,
		}));

		const soldCount = shaped.filter((c) => c.kind === 'sold').length;
		setLive(slug, { comps: shaped, street: streetPrices, streetEstimated, soldCount });
		return true;
	} catch {
		// Tables absent, network down, key rotated: mock carries the page.
		return false;
	}
}

/**
 * The catalogue to search. Falls back whole rather than per row: a partial
 * catalogue would let someone pick a fragrance the estimator cannot describe.
 */
export async function loadCatalogue() {
	if (!isSupabaseConfigured) return CATALOGUE;
	try {
		const sb = await getSupabase();
		if (!sb) return CATALOGUE;
		const { data, error } = await sb
			.from('assay_fragrances')
			.select('slug, name, house, released, family, regime, sizes')
			.eq('active', true);
		if (error || !data?.length) return CATALOGUE;

		// Keep the mock entry as the base so anything the DB does not carry yet
		// (msrp, fallback comps) still resolves.
		return data.map((row) => {
			const mock = CATALOGUE.find((c) => c.id === row.slug);
			return {
				...(mock || {}),
				id: row.slug,
				name: row.name,
				house: row.house,
				released: row.released ?? mock?.released,
				family: row.family ?? mock?.family,
				regime: row.regime ?? mock?.regime ?? 'A',
				sizes: row.sizes?.length ? row.sizes : mock?.sizes || [100],
				defaultSize: mock?.defaultSize ?? (row.sizes?.[0] || 100),
				street: mock?.street || {},
				msrp: mock?.msrp || {},
			};
		});
	} catch {
		return CATALOGUE;
	}
}

/** Fire and forget: a quote logged now is calibration data later. */
export async function logValuation(slug, inputs, result) {
	if (!isSupabaseConfigured) return;
	try {
		const sb = await getSupabase();
		if (!sb) return;
		const { data: frag } = await sb
			.from('assay_fragrances').select('id').eq('slug', slug).maybeSingle();
		await sb.from('assay_valuations').insert({
			fragrance_id: frag?.id ?? null,
			inputs,
			value: result.value,
			low: result.low,
			high: result.high,
			confidence: result.confidence,
			comp_count: result.compCount,
			model_version: 'v0.1',
		});
	} catch {
		// Logging must never be able to break a quote.
	}
}
